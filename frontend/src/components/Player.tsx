import React, { useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';
import { Slider, Button, Space, Tooltip, Badge } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SoundOutlined,
  RetweetOutlined,
  SwapOutlined,
  ReloadOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  CompressOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import { trackService } from '../services/trackService';
import { lyricsService } from '../services/lyricsService';
import PlayQueue from './PlayQueue';
import './Player.css';

// ─── inline LRC parser ────────────────────────────────────────────────
interface LyricLine { time: number; text: string; }

function parseLrc(content: string): LyricLine[] {
  const lines = content.split('\n');
  const result: LyricLine[] = [];
  lines.forEach(line => {
    const m = line.match(/\[(\d{2}):(\d{2})\.?(\d{2,3})?](.*)/); // eslint-disable-line
    if (!m) return;
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + (m[3] ? parseInt(m[3]) / (m[3].length === 2 ? 100 : 1000) : 0);
    const text = m[4].trim();
    if (text) result.push({ time, text });
  });
  return result.sort((a, b) => a.time - b.time);
}

const Player: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    volume,
    progress,
    duration,
    playMode,
    playlist,
    setVolume,
    next,
    previous,
    updateProgress,
    setDuration,
    togglePlayMode,
  } = usePlayerStore();

  const [queueVisible, setQueueVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Lyrics state
  const [lyricsContent, setLyricsContent] = useState<string | null>(null);
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const howlRef = useRef<Howl | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const currentPlayMode = usePlayerStore((state) => state.playMode);

  // Dynamic page title
  useEffect(() => {
    if (currentTrack) {
      const artists = currentTrack.artists.map((a) => a.name).join(', ');
      document.title = `${isPlaying ? '▶ ' : ''}${currentTrack.title} - ${artists} | HoYoMusic`;
    } else {
      document.title = 'HoYoMusic';
    }
  }, [currentTrack, isPlaying]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) { setLyricsContent(null); setLyricsLines([]); return; }
    lyricsService.getLyrics(currentTrack.id).then(lrc => {
      setLyricsContent(lrc);
      setLyricsLines(lrc ? parseLrc(lrc) : []);
      setActiveLyricIdx(-1);
    });
  }, [currentTrack?.id]);

  // Sync active lyric line with progress
  useEffect(() => {
    if (!lyricsLines.length) return;
    let idx = -1;
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
      if (progress >= lyricsLines[i].time) { idx = i; break; }
    }
    if (idx !== activeLyricIdx) setActiveLyricIdx(idx);
  }, [progress, lyricsLines]);

  // Auto-scroll lyrics
  useEffect(() => {
    if (activeLyricIdx >= 0 && activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIdx]);

  // Media Session API
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;
    const artists = currentTrack.artists.map((a) => a.name).join(', ');
    const coverSrc = currentTrack.cover_path
      ? trackService.getCoverUrl(currentTrack.cover_path)
      : (currentTrack as any).album_cover
        ? trackService.getCoverUrl((currentTrack as any).album_cover)
        : null;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: artists,
      album: currentTrack.album_title || '',
      artwork: coverSrc ? [{ src: coverSrc, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (howlRef.current) { howlRef.current.play(); setIsPlaying(true); }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (howlRef.current) { howlRef.current.pause(); setIsPlaying(false); }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevious());
    navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
  }, [currentTrack]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
      if (!currentTrack) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          handleTogglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.05));
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          togglePlayMode();
          break;
        case 'Escape':
          if (expanded) setExpanded(false);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTrack, isPlaying, volume, expanded]);

  useEffect(() => {
    if (currentTrack) {
      if (howlRef.current) howlRef.current.unload();
      const streamUrl = trackService.getStreamUrlPublic(currentTrack.id);
      const newHowl = new Howl({
        src: [streamUrl],
        html5: true,
        format: ['flac'],
        volume: volume,
        loop: currentPlayMode === 'single',
        onload: function () { setDuration(newHowl.duration()); },
        onplay: function () {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = window.setInterval(() => {
            if (newHowl.playing()) updateProgress(newHowl.seek() as number);
          }, 100);
        },
        onpause: function () {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        },
        onend: function () {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          if (currentPlayMode !== 'single') { setIsPlaying(false); handleNext(); }
        },
      });
      howlRef.current = newHowl;
      newHowl.play();
      setIsPlaying(true);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentTrack]);

  useEffect(() => {
    if (howlRef.current) howlRef.current.loop(currentPlayMode === 'single');
  }, [currentPlayMode]);

  useEffect(() => {
    if (howlRef.current) howlRef.current.volume(volume);
  }, [volume]);

  const handleTogglePlay = () => {
    if (!howlRef.current) return;
    if (isPlaying) { howlRef.current.pause(); setIsPlaying(false); }
    else { howlRef.current.play(); setIsPlaying(true); }
  };

  const handlePrevious = () => {
    if (howlRef.current) howlRef.current.unload();
    previous();
  };

  const handleNext = () => {
    if (howlRef.current) howlRef.current.unload();
    next();
  };

  const handleSeek = (value: number) => {
    if (howlRef.current) { howlRef.current.seek(value); updateProgress(value); }
  };

  const handleVolumeChange = (value: number) => {
    if (howlRef.current) howlRef.current.volume(value);
    setVolume(value);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlayModeIcon = () => {
    switch (playMode) {
      case 'sequence': return <OrderedListOutlined />;
      case 'loop':     return <RetweetOutlined />;
      case 'shuffle':  return <SwapOutlined />;
      case 'single':   return <ReloadOutlined />;
      default:         return <OrderedListOutlined />;
    }
  };

  const getPlayModeText = () => {
    switch (playMode) {
      case 'sequence': return '顺序播放';
      case 'loop':     return '列表循环';
      case 'shuffle':  return '随机播放';
      case 'single':   return '单曲循环';
      default:         return '顺序播放';
    }
  };

  if (!currentTrack) return null;

  const coverSrc = currentTrack.cover_path
    ? trackService.getCoverUrl(currentTrack.cover_path)
    : (currentTrack as any).album_cover
      ? trackService.getCoverUrl((currentTrack as any).album_cover)
      : null;

  // ─── Controls bar (shared between collapsed & expanded) ───
  const controlsBar = (
    <div className="player-controls">
      <Space size="large">
        <Tooltip title={`${getPlayModeText()}（按 L 切换）`}>
          <Button type="text" icon={getPlayModeIcon()} onClick={togglePlayMode} size="large" />
        </Tooltip>
        <Tooltip title="上一曲（←）">
          <Button type="text" icon={<StepBackwardOutlined />} onClick={handlePrevious} size="large" />
        </Tooltip>
        <Tooltip title={isPlaying ? '暂停（空格）' : '播放（空格）'}>
          <Button
            type="primary"
            shape="circle"
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={handleTogglePlay}
            size="large"
          />
        </Tooltip>
        <Tooltip title="下一曲（→）">
          <Button type="text" icon={<StepForwardOutlined />} onClick={handleNext} size="large" />
        </Tooltip>
      </Space>
      <div className="player-progress">
        <span className="player-time">{formatTime(progress)}</span>
        <Slider
          value={progress}
          max={duration}
          onChange={handleSeek}
          tooltip={{ formatter: (value) => formatTime(value || 0) }}
          className="player-slider"
        />
        <span className="player-time">{formatTime(duration)}</span>
      </div>
    </div>
  );

  // ─── Expanded fullscreen view ─────────────────────────────
  if (expanded) {
    return (
      <div className="player-expanded">
        {/* blurred bg */}
        {coverSrc && (
          <div className="player-expanded-bg" style={{ backgroundImage: `url(${coverSrc})` }} />
        )}
        {/* top: cover + lyrics */}
        <div className="player-expanded-body">
          {/* Left: cover + track info */}
          <div className="player-expanded-left">
            {coverSrc ? (
              <img src={coverSrc} alt={currentTrack.title} className="player-expanded-cover" />
            ) : (
              <div className="player-expanded-cover player-expanded-cover--placeholder">
                <SoundOutlined style={{ fontSize: 64, opacity: 0.4 }} />
              </div>
            )}
            <div className="player-expanded-title">{currentTrack.title}</div>
            <div className="player-expanded-artist">
              {currentTrack.artists.map(a => a.name).join(', ')}
            </div>
            {currentTrack.album_title && (
              <div className="player-expanded-album">{currentTrack.album_title}</div>
            )}
          </div>

          {/* Right: scrolling lyrics */}
          <div className="player-expanded-lyrics-wrap">
            <div className="player-expanded-lyrics-container" ref={lyricsContainerRef}>
              {lyricsLines.length > 0 ? (
                lyricsLines.map((line, idx) => (
                  <div
                    key={idx}
                    ref={idx === activeLyricIdx ? activeLineRef : undefined}
                    className={[
                      'player-lyric-line',
                      idx === activeLyricIdx ? 'active' : '',
                      idx < activeLyricIdx ? 'passed' : '',
                    ].join(' ')}
                    onClick={() => handleSeek(line.time)}
                    title="点击跳转"
                  >
                    {line.text}
                  </div>
                ))
              ) : (
                <div className="player-lyric-empty">
                  {lyricsContent === null ? '暂无歌词' : '纯音乐，请欣赏'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* bottom: controls bar */}
        <div className="player-expanded-controls">
          <div className="player-expanded-controls-inner">
            {/* mini track info */}
            <div className="player-track-info" style={{ flex: 1, minWidth: 0 }}>
              {coverSrc && (
                <img src={coverSrc} alt={currentTrack.title} className="player-cover" style={{ width: 44, height: 44 }} />
              )}
              <div className="player-text">
                <div className="player-title">{currentTrack.title}</div>
                <div className="player-artist">{currentTrack.artists.map(a => a.name).join(', ')}</div>
              </div>
            </div>

            {controlsBar}

            <div className="player-volume">
              <Tooltip title="音量（↑/↓ 调节）"><SoundOutlined /></Tooltip>
              <Slider value={volume} min={0} max={1} step={0.01} onChange={handleVolumeChange} style={{ width: 100, marginLeft: 12 }} />
              <Tooltip title="播放队列">
                <Badge count={playlist.length} showZero>
                  <Button type="text" icon={<UnorderedListOutlined />} onClick={() => setQueueVisible(true)} size="large" style={{ marginLeft: 16 }} />
                </Badge>
              </Tooltip>
              <Tooltip title="收起（Esc）">
                <Button type="text" icon={<CompressOutlined />} onClick={() => setExpanded(false)} size="large" style={{ marginLeft: 8 }} />
              </Tooltip>
            </div>
          </div>
        </div>

        <PlayQueue visible={queueVisible} onClose={() => setQueueVisible(false)} />
      </div>
    );
  }

  // ─── Collapsed mini bar ───────────────────────────────────
  return (
    <div className="player-container">
      {/* clickable empty area expands */}
      <div
        className="player-expand-hint"
        onClick={() => setExpanded(true)}
        title="点击展开查看歌词"
      />
      <div className="player-content">
        <div className="player-track-info">
          {coverSrc ? (
            <img src={coverSrc} alt={currentTrack.title} className="player-cover" onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }} />
          ) : null}
          <div className="player-text" onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }}>
            <div className="player-title">{currentTrack.title}</div>
            <div className="player-artist">{currentTrack.artists.map((a) => a.name).join(', ')}</div>
          </div>
        </div>

        {controlsBar}

        <div className="player-volume">
          <Tooltip title="音量（↑/↓ 调节）"><SoundOutlined /></Tooltip>
          <Slider value={volume} min={0} max={1} step={0.01} onChange={handleVolumeChange} style={{ width: 100, marginLeft: 12 }} />
          <Tooltip title="展开歌词">
            <Button type="text" icon={<ExpandOutlined />} onClick={() => setExpanded(true)} size="large" style={{ marginLeft: 8 }} />
          </Tooltip>
          <Tooltip title="播放队列">
            <Badge count={playlist.length} showZero>
              <Button type="text" icon={<UnorderedListOutlined />} onClick={() => setQueueVisible(true)} size="large" style={{ marginLeft: 4 }} />
            </Badge>
          </Tooltip>
        </div>
      </div>

      <PlayQueue visible={queueVisible} onClose={() => setQueueVisible(false)} />
    </div>
  );
};

export default Player;

