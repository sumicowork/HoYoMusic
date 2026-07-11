// HoYoMusic desktop — Tauri v2 command implementations.
//
// Every command is best-effort and defensively logs instead of panicking.
// Windows SMTC (SystemMediaTransportControls) integration is stubbed because
// driving WinRT SMTC from pure Rust requires the `windows` crate (heavy, Windows
// only). The event channel `media-action` / `global-shortcut` is wired so a
// future SMTC integration (or a `tauri-plugin-mpris`-style plugin) can emit to
// the same listeners the frontend already subscribes to.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;
use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut, ShortcutState,
};

/// Tracks the "now playing" payload so it can be re-emitted or used by a future
/// SMTC integration. Cheap, optional state.
#[derive(Default)]
pub struct PlayerState {
    title: Mutex<Option<String>>,
    artist: Mutex<Option<String>>,
    album: Mutex<Option<String>>,
    is_playing: Mutex<bool>,
}

/// Payload describing the current track, surfaced to the frontend on changes.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub cover_path: Option<String>,
}

/// Update the currently-playing track metadata. Best-effort: stores it in app
/// state and logs. A real SMTC/MPRIS integration would push it to the OS here.
#[tauri::command]
pub fn set_media_metadata(
    app: AppHandle,
    title: String,
    artist: String,
    album: Option<String>,
    cover_path: Option<String>,
) -> Result<(), String> {
    let state = app.state::<PlayerState>();
    *state.title.lock().unwrap() = Some(title.clone());
    *state.artist.lock().unwrap() = Some(artist.clone());
    *state.album.lock().unwrap() = album.clone();

    let payload = MediaMetadata {
        title,
        artist,
        album,
        cover_path,
    };
    // Let the frontend know metadata changed (e.g. to render in a title bar).
    let _ = app.emit("media-metadata", payload);
    log::info!("set_media_metadata: stored now-playing metadata");
    Ok(())
}

/// Reflect playback state (playing / paused) to the OS media session.
#[tauri::command]
pub fn set_playback_state(app: AppHandle, is_playing: bool) -> Result<(), String> {
    let state = app.state::<PlayerState>();
    *state.is_playing.lock().unwrap() = is_playing;
    let _ = app.emit("playback-state", is_playing);
    log::info!("set_playback_state: is_playing={is_playing}");
    Ok(())
}

/// Register intent to receive media key / SMTC actions. Real OS-level hookup
/// (Windows SMTC, macOS MPRemoteCommandCenter, Linux MPRIS) is platform
/// specific; here we log and keep the `media-action` event channel open so the
/// frontend listener (`onMediaAction`) is ready when a backend integration
/// emits. See module docs for the planned upgrade path.
#[tauri::command]
pub fn register_media_action() -> Result<(), String> {
    log::info!(
        "register_media_action: media-action event channel ready (SMTC stub)"
    );
    Ok(())
}

/// Show the main window (bring it back from the tray).
#[tauri::command]
pub fn show_tray(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
    // Toggle tray icon visibility if a tray was created with id "main".
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_visible(true);
    }
    log::info!("show_tray: window restored");
    Ok(())
}

/// Hide the main window to the system tray.
#[tauri::command]
pub fn hide_to_tray(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    log::info!("hide_to_tray: window hidden to tray");
    Ok(())
}

/// Register a global keyboard shortcut (e.g. "Space", "CmdOrCtrl+Right").
/// When the shortcut is pressed we emit a `global-shortcut` event carrying the
/// accelerator string; the TS bridge maps it back to the caller's callback.
#[tauri::command]
pub fn register_shortcut(app: AppHandle, accelerator: String) -> Result<(), String> {
    let acc = accelerator.clone();
    let shortcut: Shortcut = acc
        .parse()
        .map_err(|e| format!("invalid accelerator '{accelerator}': {e}"))?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _sc, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app.emit("global-shortcut", acc.clone());
            }
        })
        .map_err(|e| format!("failed to register shortcut: {e}"))?;

    log::info!("register_shortcut: registered '{accelerator}'");
    Ok(())
}

/// Real streaming download of an audio file via `reqwest`. Bytes are written to
/// disk as they arrive and `download-progress` events are emitted (payload
/// `{id, progress: 0..1, path}`); on failure a `download-error` event with
/// `{id, error}` is emitted and the command returns `Err`.
#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    id: String,
    title: String,
    audio_url: String,
) -> Result<(), String> {
    let dir = downloads_dir(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let safe_name = sanitize(&title).unwrap_or_else(|| id.clone());
    let ext = infer_ext(&audio_url);
    let file_path = dir.join(format!("{safe_name}.{ext}"));

    match stream_download(&app, &id, &file_path, &audio_url).await {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = app.emit(
                "download-error",
                serde_json::json!({ "id": id, "error": e }),
            );
            Err(e)
        }
    }
}

/// Fetch `audio_url` and stream the response body into `file_path`, emitting
/// progress in the range 0.0..=1.0. When the server omits a `Content-Length`
/// header we cannot compute a fraction, so we emit `0.0` until the final
/// `1.0` tick (we still emit intermediate ticks every ~256KB for UI feedback).
async fn stream_download(
    app: &AppHandle,
    id: &str,
    file_path: &PathBuf,
    audio_url: &str,
) -> Result<(), String> {
    let resp = reqwest::Client::new()
        .get(audio_url)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("unexpected HTTP status {}", resp.status()));
    }

    let total = resp.content_length();
    let mut file = tokio::fs::File::create(file_path)
        .await
        .map_err(|e| format!("create file failed: {e}"))?;

    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;
    let path_str = file_path.to_string_lossy().to_string();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("stream error: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write failed: {e}"))?;
        downloaded += chunk.len() as u64;

        // Emit roughly every ~256KB, or immediately when total is known so the
        // fraction stays accurate.
        if total.is_some() || downloaded - last_emit >= 256 * 1024 {
            last_emit = downloaded;
            let progress = match total {
                Some(t) if t > 0 => (downloaded as f64 / t as f64).clamp(0.0, 1.0),
                _ => 0.0,
            };
            let _ = app.emit(
                "download-progress",
                serde_json::json!({ "id": id, "progress": progress, "path": path_str }),
            );
        }
    }

    file.flush().await.map_err(|e| format!("flush failed: {e}"))?;
    drop(file);

    let _ = app.emit(
        "download-progress",
        serde_json::json!({ "id": id, "progress": 1.0, "path": path_str }),
    );
    log::info!("start_download: saved audio to {}", path_str);
    Ok(())
}

/// Infer an audio file extension from the URL's path (ignoring query string).
/// Falls back to `.mp3` when none of the known extensions is found.
fn infer_ext(url: &str) -> &'static str {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".flac") {
        "flac"
    } else if lower.ends_with(".wav") {
        "wav"
    } else if lower.ends_with(".ogg") {
        "ogg"
    } else {
        "mp3"
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn downloads_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?;
    Ok(base.join("HoYoMusic"))
}

fn sanitize(name: &str) -> Option<String> {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect();
    if cleaned.trim().is_empty() {
        None
    } else {
        Some(cleaned.trim().to_string())
    }
}
