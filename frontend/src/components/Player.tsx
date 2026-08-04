import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { Slider, Button, Space, Tooltip, Badge } from 'antd';
import { useNavigate } from 'react-router-dom';
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
  HeartOutlined,
  HeartFilled,
} from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import { trackService } from '../services/trackService';
import { useDominantColor } from '../utils/useDominantColor';
import { lyricsService } from '../services/lyricsService';
import favoriteService from '../services/favoriteService';
import { useDebugUserFeatures } from '../utils/debugFeature';
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
  const navigate = useNavigate();
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
  const [collapsing, setCollapsing] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const canUseDebugUserFeatures = useDebugUserFeatures();

  // Cover URLs memoized for hook dependencies
  const coverSrc = useMemo((): string | null => {
    if (!currentTrack) return null;
    const path = currentTrack.cover_path || currentTrack.album_cover;
    return path ? trackService.getCoverUrl(path) : null;
  }, [currentTrack?.cover_path, currentTrack?.album_cover]);

  const coverThumbSrc = useMemo((): string | null => {
    if (!currentTrack) return null;
    const path = currentTrack.cover_path || currentTrack.album_cover;
    return path ? trackService.getCoverUrl(path, true) : null;
  }, [currentTrack?.cover_path, currentTrack?.album_cover]);

  const dominantColor = useDominantColor(coverSrc || '');

  const handleCollapse = () => {
    setCollapsing(true);
    setTimeout(() => {
      setExpanded(false);
      setCollapsing(false);
    }, 320);
  };

  // Lyrics state
  const [lyricsContent, setLyricsContent] = useState<string | null>(null);
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const howlRef = useRef<Howl | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const playSessionKeyRef = useRef<string | null>(null);
  const effectivePlayReportedRef = useRef(false);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const currentPlayMode = usePlayerStore((state) => state.playMode);

  const getEffectivePlayThreshold = (trackDuration: number | null | undefined) => {
    const safeDuration = trackDuration && trackDuration > 0 ? trackDuration : 60;
    return Math.max(10, Math.min(30, safeDuration * 0.5));
  };

  const tryReportEffectivePlay = (playedSeconds: number) => {
    if (!currentTrack || effectivePlayReportedRef.current) return;

    const durationForRule = (duration && duration > 0 ? duration : currentTrack.duration) ?? null;
    const threshold = getEffectivePlayThreshold(durationForRule);
    if (playedSeconds < threshold) return;

    const sessionKey = playSessionKeyRef.current
      || `${currentTrack.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    playSessionKeyRef.current = sessionKey;

    trackService.recordPlay(currentTrack.id, {
      playedSeconds,
      trackDurationSeconds: durationForRule,
      sessionKey,
    });
    effectivePlayReportedRef.current = true;
  };

  // Dynamic page title
  useEffect(() => {
    if (currentTrack) {
      document.title = `${isPlaying ? '▶ ' : ''}${currentTrack.title} | HoYoMusic`;
    } else {
      document.title = 'HoYoMusic';
    }
  }, [currentTrack, isPlaying]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsContent(null);
      setLyricsLines([]);
      setActiveLyricIdx(-1);
      return;
    }

    let canceled = false;
    const trackId = currentTrack.id;

    lyricsService.getLyrics(trackId).then((lrc) => {
      if (canceled || usePlayerStore.getState().currentTrack?.id !== trackId) {
        return;
      }
      setLyricsContent(lrc);
      setLyricsLines(lrc ? parseLrc(lrc) : []);
      setActiveLyricIdx(-1);
    });

    return () => {
      canceled = true;
    };
  }, [currentTrack?.id]);

  // Reset cover load state on track change
  useEffect(() => {
    setCoverLoaded(false);
  }, [currentTrack?.id]);

  useEffect(() => {
    setFavoriteCount(Math.max(0, Number(currentTrack?.favorite_count || 0)));
  }, [currentTrack?.id, currentTrack?.favorite_count]);

  useEffect(() => {
    if (!canUseDebugUserFeatures || !currentTrack?.id) {
      setIsFavorited(false);
      return;
    }

    let canceled = false;
    favoriteService.checkFavorites([currentTrack.id]).then((data) => {
      if (!canceled) {
        setIsFavorited(Boolean(data[currentTrack.id]));
      }
    }).catch(() => {
      if (!canceled) {
        setIsFavorited(false);
      }
    });

    return () => {
      canceled = true;
    };
  }, [currentTrack?.id, canUseDebugUserFeatures]);

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
    if (!('mediaSession' in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      return;
    }

    const coverSrc = currentTrack.cover_path
      ? trackService.getCoverUrl(currentTrack.cover_path)
      : currentTrack.album_cover
        ? trackService.getCoverUrl(currentTrack.album_cover)
        : null;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: '',
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

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
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
          if (howlRef.current) { const t = Math.max(0, (howlRef.current.seek() as number) - 5); howlRef.current.seek(t); updateProgress(t); }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (howlRef.current) { const t = Math.min(duration, (howlRef.current.seek() as number) + 5); howlRef.current.seek(t); updateProgress(t); }
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
        case 'm':
        case 'M':
          e.preventDefault();
          handleVolumeChange(volume > 0 ? 0 : 0.8);
          break;
        case 'Escape':
          if (expanded) handleCollapse();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps — handlers not memoized, adding them causes unnecessary re-registration
  }, [currentTrack, isPlaying, volume, expanded]);

  useEffect(() => {
    if (!currentTrack) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
      playSessionKeyRef.current = null;
      effectivePlayReportedRef.current = false;
      setIsPlaying(false);
      updateProgress(0);
      setDuration(0);
      return;
    }

    playSessionKeyRef.current = `${currentTrack.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    effectivePlayReportedRef.current = false;

    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    updateProgress(0);
    const streamUrl = trackService.getStreamUrlPublic(currentTrack.id);
    const newHowl = new Howl({
      src: [streamUrl],
      html5: true,
      format: currentTrack?.file_path?.toLowerCase().endsWith('.mp3') ? ['mp3'] : ['flac'],
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
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      },
      onend: function () {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        tryReportEffectivePlay(newHowl.duration());
        if (usePlayerStore.getState().playMode !== 'single') {
          setIsPlaying(false);
          handleNext();
        }
      },
    });
    howlRef.current = newHowl;
    if (isPlaying) {
      newHowl.play();
      setIsPlaying(true);
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // App conditionally unmounts Player when currentTrack becomes null,
      // so we must release the current Howl here to prevent ghost playback.
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
    };
  }, [currentTrack]);

  useEffect(() => {
    if (!howlRef.current) return;
    if (isPlaying && !howlRef.current.playing()) {
      howlRef.current.play();
    } else if (!isPlaying && howlRef.current.playing()) {
      howlRef.current.pause();
    }
  }, [isPlaying, currentTrack?.id]);

  useEffect(() => {
    tryReportEffectivePlay(progress);
  }, [progress, duration, currentTrack?.id]);

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
    const switched = previous();
    if (!switched && howlRef.current) {
      howlRef.current.seek(0);
      updateProgress(0);
    }
  };

  const handleNext = () => {
    const switched = next();
    if (!switched && howlRef.current) {
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number) => {
    if (howlRef.current) { howlRef.current.seek(value); updateProgress(value); }
  };

  const handleVolumeChange = (value: number) => {
    if (howlRef.current) howlRef.current.volume(value);
    setVolume(value);
  };

  const handleToggleFavorite = async () => {
    if (!currentTrack || !canUseDebugUserFeatures) return;
    try {
      const result = await favoriteService.toggle(currentTrack.id);
      setIsFavorited(result.favorited);
      setFavoriteCount((prev) => Math.max(0, prev + (result.favorited ? 1 : -1)));
    } catch {
      // Keep player interactions silent for this debug-only shortcut.
    }
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

  // ─── Controls bar (shared between collapsed & expanded) ───
  const controlsBar = (
    <div className="player-controls">
      <Space size="large">
        <Tooltip title={`${getPlayModeText()}（按 L 切换）`}>
          <Button type="text" icon={getPlayModeIcon()} onClick={togglePlayMode} size="large" aria-label={getPlayModeText()} />
        </Tooltip>
        <Tooltip title="上一曲（←）">
          <Button type="text" icon={<StepBackwardOutlined />} onClick={handlePrevious} size="large" aria-label="上一曲" />
        </Tooltip>
        <Tooltip title={isPlaying ? '暂停（空格）' : '播放（空格）'}>
          <Button
            type="primary"
            shape="circle"
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={handleTogglePlay}
            size="large"
            aria-label={isPlaying ? '暂停' : '播放'}
          />
        </Tooltip>
        <Tooltip title="下一曲（→）">
          <Button type="text" icon={<StepForwardOutlined />} onClick={handleNext} size="large" aria-label="下一曲" />
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
          aria-label="播放进度"
        />
        <span className="player-time">{formatTime(duration)}</span>
      </div>
    </div>
  );

  // ─── Expanded fullscreen view ─────────────────────────────
  if (expanded) {
    return (
      <div className={`player-expanded${collapsing ? ' player-collapsing' : ''}`} style={{ '--player-dominant': dominantColor || 'var(--aurora-1)' } as React.CSSProperties}>
        {/* dark gradient bg — click to collapse */}
        <div
          className="player-expanded-bg"
          onClick={handleCollapse}
        />
        {/* top-right close button */}
        <Button
          type="text"
          icon={<CompressOutlined />}
          onClick={handleCollapse}
          className="player-expanded-close"
          aria-label="收起播放器"
        />
        {/* top: cover + lyrics */}
        <div className="player-expanded-body">
          {/* Left: cover + track info */}
          <div className="player-expanded-left">
            <div className={`player-expanded-cover-wrap${isPlaying ? ' player-cover-spinning' : ''}`}>
              {coverSrc ? (
                <img
                  key={currentTrack.id}
                  src={coverSrc}
                  alt={currentTrack.title}
                  className={`player-expanded-cover${coverLoaded ? ' loaded' : ''}`}
                  onLoad={() => setCoverLoaded(true)}
                />
              ) : (
                <div className="player-expanded-cover player-expanded-cover--placeholder loaded">
                  <SoundOutlined style={{ fontSize: 64, opacity: 0.4 }} />
                </div>
              )}
            </div>
            <div className={`player-visualizer${isPlaying ? '' : ' player-visualizer-paused'}`}>
              <div className="player-visualizer-bar" />
              <div className="player-visualizer-bar" />
              <div className="player-visualizer-bar" />
              <div className="player-visualizer-bar" />
              <div className="player-visualizer-bar" />
            </div>
            <div
              key={`title-${currentTrack.id}`}
              className="player-expanded-title"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/track/${currentTrack.id}`)}
            >
              {currentTrack.title}
            </div>
            {currentTrack.album_title && (
              <div
                key={`album-${currentTrack.id}`}
                className="player-expanded-album"
                style={{ cursor: currentTrack.album_id ? 'pointer' : 'default' }}
                onClick={() => currentTrack.album_id && navigate(`/albums/${currentTrack.album_id}`)}
              >
                {currentTrack.album_title}
              </div>
            )}
            <div className="player-expanded-likes">
              <HeartFilled style={{ color: '#ff4d6a', marginRight: 6 }} />
              {favoriteCount} 人喜爱
            </div>
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
              {coverThumbSrc && (
                <img src={coverThumbSrc} alt={currentTrack.title} className="player-cover" style={{ width: 44, height: 44 }} />
              )}
              <div className="player-text">
                <div
                  className="player-title"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/track/${currentTrack.id}`)}
                >
                  {currentTrack.title}
                </div>
              </div>
            </div>

            {controlsBar}

            <div className="player-volume">
              <Tooltip title="音量（↑/↓ 调节）"><SoundOutlined /></Tooltip>
              <Slider value={volume} min={0} max={1} step={0.01} onChange={handleVolumeChange} style={{ width: 100, marginLeft: 12 }} aria-label="音量" />
              {canUseDebugUserFeatures && (
                <Tooltip title={isFavorited ? '取消喜爱' : '喜爱'}>
                  <Button
                    type="text"
                    icon={isFavorited ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
                    onClick={handleToggleFavorite}
                    size="large"
                    style={{ marginLeft: 8 }}
                    aria-label={isFavorited ? '取消喜爱' : '喜爱'}
                  />
                </Tooltip>
              )}
              <Tooltip title="播放队列">
                <Badge count={playlist.length} showZero>
                  <Button type="text" icon={<UnorderedListOutlined />} onClick={() => setQueueVisible(true)} size="large" style={{ marginLeft: 8 }} aria-label="播放队列" />
                </Badge>
              </Tooltip>
              <Tooltip title="收起（Esc）">
                <Button type="text" icon={<CompressOutlined />} onClick={handleCollapse} size="large" style={{ marginLeft: 4 }} aria-label="收起播放器" />
              </Tooltip>
            </div>
          </div>

          <div className="player-expanded-mobile-controls">
            <div className="player-expanded-mobile-main">
              <Button type="text" icon={<StepBackwardOutlined />} onClick={handlePrevious} size="large" aria-label="上一曲" />
              <Button
                type="primary"
                shape="circle"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handleTogglePlay}
                size="large"
                aria-label={isPlaying ? '暂停' : '播放'}
              />
              <Button type="text" icon={<StepForwardOutlined />} onClick={handleNext} size="large" aria-label="下一曲" />
            </div>

            <div className="player-expanded-mobile-progress">
              <span className="player-time">{formatTime(progress)}</span>
              <Slider
                value={progress}
                max={duration}
                onChange={handleSeek}
                tooltip={{ formatter: (value) => formatTime(value || 0) }}
                className="player-slider"
                aria-label="播放进度"
              />
              <span className="player-time">{formatTime(duration)}</span>
            </div>

            <div className="player-expanded-mobile-actions">
              {canUseDebugUserFeatures && (
                <Button
                  type="text"
                  icon={isFavorited ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
                  onClick={handleToggleFavorite}
                  size="large"
                  aria-label={isFavorited ? '取消喜爱' : '喜爱'}
                />
              )}
              <Button type="text" icon={getPlayModeIcon()} onClick={togglePlayMode} size="large" aria-label={getPlayModeText()} />
              <div className="player-expanded-mobile-volume">
                <SoundOutlined />
                <Slider value={volume} min={0} max={1} step={0.01} onChange={handleVolumeChange} style={{ width: 100 }} aria-label="音量" />
              </div>
              <Badge count={playlist.length} showZero>
                <Button type="text" icon={<UnorderedListOutlined />} onClick={() => setQueueVisible(true)} size="large" aria-label="播放队列" />
              </Badge>
              <Button type="text" icon={<CompressOutlined />} onClick={handleCollapse} size="large" aria-label="收起播放器" />
            </div>
          </div>
        </div>

        <PlayQueue visible={queueVisible} onClose={() => setQueueVisible(false)} />
      </div>
    );
  }

  // ─── Collapsed mini bar ───────────────────────────────────
  return (
    <div className="player-container" role="region" aria-label="音乐播放器">
      {/* clickable empty area expands */}
      <div
        className="player-expand-hint"
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); } }}
        tabIndex={0}
        role="button"
        aria-label="展开播放器查看歌词"
        title="点击展开查看歌词"
      />
      <div className="player-content">
        <div className="player-track-info">
          {coverThumbSrc ? (
            <img src={coverThumbSrc} alt={currentTrack.title} className={`player-cover${isPlaying ? ' player-cover-spinning' : ''}`} onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }} />
          ) : null}
          <div className="player-text" onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }}>
            <div className="player-title">{currentTrack.title}</div>
            <div className="player-artist">
              <HeartFilled style={{ color: '#ff4d6a', marginRight: 4 }} />
              {favoriteCount}
            </div>
          </div>
        </div>

        <div className="player-desktop-only player-controls-wrapper">{controlsBar}</div>

        <div className="player-volume player-desktop-only">
          <Tooltip title="音量（↑/↓ 调节）"><SoundOutlined /></Tooltip>
          <Slider value={volume} min={0} max={1} step={0.01} onChange={handleVolumeChange} style={{ width: 100, marginLeft: 12 }} aria-label="音量" />
          {canUseDebugUserFeatures && (
            <Tooltip title={isFavorited ? '取消喜爱' : '喜爱'}>
              <Button
                type="text"
                icon={isFavorited ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
                onClick={handleToggleFavorite}
                size="large"
                style={{ marginLeft: 8 }}
                aria-label={isFavorited ? '取消喜爱' : '喜爱'}
              />
            </Tooltip>
          )}
          <Tooltip title="播放队列">
            <Badge count={playlist.length} showZero>
              <Button type="text" icon={<UnorderedListOutlined />} onClick={() => setQueueVisible(true)} size="large" style={{ marginLeft: 8 }} aria-label="播放队列" />
            </Badge>
          </Tooltip>
          <Tooltip title="展开歌词">
            <Button type="text" icon={<ExpandOutlined />} onClick={() => setExpanded(true)} size="large" style={{ marginLeft: 4 }} aria-label="展开歌词" />
          </Tooltip>
        </div>

        <div className="player-mobile-actions">
          {canUseDebugUserFeatures && (
            <Tooltip title={isFavorited ? '取消喜爱' : '喜爱'}>
              <Button
                type="text"
                icon={isFavorited ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
                onClick={handleToggleFavorite}
                size="large"
                aria-label={isFavorited ? '取消喜爱' : '喜爱'}
              />
            </Tooltip>
          )}
          <Tooltip title={isPlaying ? '暂停（空格）' : '播放（空格）'}>
            <Button
              type="primary"
              shape="circle"
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleTogglePlay}
              size="large"
              aria-label={isPlaying ? '暂停' : '播放'}
            />
          </Tooltip>
          <Tooltip title="播放队列">
            <Badge count={playlist.length} showZero>
              <Button type="text" icon={<UnorderedListOutlined />} onClick={() => setQueueVisible(true)} size="large" aria-label="播放队列" />
            </Badge>
          </Tooltip>
        </div>
      </div>

      <div className="player-mini-progress-bar" style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }} />

      <PlayQueue visible={queueVisible} onClose={() => setQueueVisible(false)} />
    </div>
  );
};

export default Player;

