// HoYoMusic desktop — Tauri v2 application entry (library side).
//
// `main.rs` calls [`run`]; this module owns the builder, plugin registration,
// shared state, the (best-effort) system tray, and the command handler list.

mod commands;

use commands::PlayerState;
use tauri::Manager;
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(PlayerState::default())
        .setup(|app| {
            // Best-effort system tray. Requires a bundled window icon
            // (icons/*.png/.ico in tauri.conf.json). If absent we simply skip
            // it so the app still launches.
            if let Some(icon) = app.default_window_icon().cloned() {
                let _ = TrayIconBuilder::with_id("main")
                    .icon(icon)
                    .tooltip("HoYoMusic")
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            ..
                        } = event
                        {
                            if let Some(win) = tray.app_handle().get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(app);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_media_metadata,
            commands::set_playback_state,
            commands::register_media_action,
            commands::show_tray,
            commands::hide_to_tray,
            commands::register_shortcut,
            commands::start_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HoYoMusic tauri application");
}
