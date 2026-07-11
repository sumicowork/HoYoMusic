import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks must be hoisted so the tauri bridge picks up the mocked `invoke`
// (imported at module top). We expose the mock fns via vi.hoisted so tests
// can assert on call arguments.
const { invokeMock, showMock, hideMock, focusMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(() => Promise.resolve()),
  showMock: vi.fn(() => Promise.resolve()),
  hideMock: vi.fn(() => Promise.resolve()),
  focusMock: vi.fn(() => Promise.resolve()),
  listenMock: vi.fn(() => Promise.resolve(() => undefined)),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ show: showMock, hide: hideMock, setFocus: focusMock }),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

import tauri from './tauri';

function setTauriEnv(exists: boolean) {
  if (exists) {
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};
  } else {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  }
}

beforeEach(() => {
  invokeMock.mockClear();
  showMock.mockClear();
  hideMock.mockClear();
  focusMock.mockClear();
  listenMock.mockClear();
  setTauriEnv(false); // browser by default
});

describe('tauri bridge — browser (no-op) mode', () => {
  it('does not call invoke when window.__TAURI__ is undefined', async () => {
    await tauri.setMediaMetadata({ title: 'a', artist: 'b' });
    await tauri.setPlaybackState(true);
    await tauri.startDownload({ id: '1', title: 'x', audioUrl: 'y' });
    await tauri.registerShortcut('Space', () => undefined);
    await tauri.showTray();
    await tauri.hideToTray();

    expect(invokeMock).not.toHaveBeenCalled();
    expect(showMock).not.toHaveBeenCalled();
    expect(hideMock).not.toHaveBeenCalled();
  });

  it('onMediaAction does not throw and does not register anything', () => {
    expect(() => tauri.onMediaAction(() => undefined)).not.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
  });

  it('raw invoke passthrough is safe and returns undefined (no throw)', async () => {
    // Even in browser mode the passthrough directly calls the mocked invoke,
    // so we assert it forwards the command & args.
    await expect(tauri.invoke('some_cmd', { a: 1 })).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith('some_cmd', { a: 1 });
  });
});

describe('tauri bridge — Tauri runtime mode', () => {
  beforeEach(() => {
    setTauriEnv(true);
  });

  it('setMediaMetadata forwards the mapped command and args', async () => {
    await tauri.setMediaMetadata({
      title: 'Song',
      artist: 'Band',
      album: 'LP',
      coverPath: '/p.png',
    });
    expect(invokeMock).toHaveBeenCalledWith('set_media_metadata', {
      title: 'Song',
      artist: 'Band',
      album: 'LP',
      coverPath: '/p.png',
    });
  });

  it('setMediaMetadata sends null for missing optional fields', async () => {
    await tauri.setMediaMetadata({ title: 'S', artist: 'A' });
    expect(invokeMock).toHaveBeenCalledWith('set_media_metadata', {
      title: 'S',
      artist: 'A',
      album: null,
      coverPath: null,
    });
  });

  it('setPlaybackState forwards isPlaying', async () => {
    await tauri.setPlaybackState(true);
    expect(invokeMock).toHaveBeenCalledWith('set_playback_state', { isPlaying: true });
  });

  it('startDownload forwards the download payload', async () => {
    await tauri.startDownload({ id: '9', title: 'T', audioUrl: 'http://x/z.mp3' });
    expect(invokeMock).toHaveBeenCalledWith('start_download', {
      id: '9',
      title: 'T',
      audioUrl: 'http://x/z.mp3',
    });
  });

  it('registerShortcut forwards the accelerator and registers the listener', async () => {
    await tauri.registerShortcut('CmdOrCtrl+Right', () => undefined);
    expect(invokeMock).toHaveBeenCalledWith('register_shortcut', {
      accelerator: 'CmdOrCtrl+Right',
    });
    expect(listenMock).toHaveBeenCalledWith('global-shortcut', expect.any(Function));
  });

  it('onMediaAction registers the media-action event listener', async () => {
    tauri.onMediaAction(() => undefined);
    expect(invokeMock).toHaveBeenCalledWith('register_media_action');
    expect(listenMock).toHaveBeenCalledWith('media-action', expect.any(Function));
  });

  it('showTray shows and focuses the window', async () => {
    await tauri.showTray();
    expect(showMock).toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalled();
  });

  it('hideToTray hides the window', async () => {
    await tauri.hideToTray();
    expect(hideMock).toHaveBeenCalled();
  });
});
