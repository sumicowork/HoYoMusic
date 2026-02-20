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
} from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import { trackService } from '../services/trackService';
import PlayQueue from './PlayQueue';
import './Player.css';

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

  const howlRef = useRef<Howl | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const currentPlayMode = usePlayerStore((state) => state.playMode);

  useEffect(() => {
    if (currentTrack) {
      // Unload previous howl
      if (howlRef.current) {
        howlRef.current.unload();
      }

      // Create new howl - use public stream URL (no auth required)
      const streamUrl = trackService.getStreamUrlPublic(currentTrack.id);
      const newHowl = new Howl({
        src: [streamUrl],
        html5: true,
        format: ['flac'],
        volume: volume,
        loop: currentPlayMode === 'single', // 单曲循环模式下启用 loop
        onload: function () {
          setDuration(newHowl.duration());
        },
        onplay: function () {
          // Update progress only, state is managed by handleTogglePlay
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          progressIntervalRef.current = window.setInterval(() => {
            if (newHowl.playing()) {
              updateProgress(newHowl.seek() as number);
            }
          }, 100);
        },
        onpause: function () {
          // Clear progress timer only, state is managed by handleTogglePlay
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        },
        onend: function () {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          // 单曲循环模式下，onend 不会触发（因为 loop: true）
          // 其他模式下，播放下一曲
          if (currentPlayMode !== 'single') {
            setIsPlaying(false);
            handleNext();
          }
        },
      });

      howlRef.current = newHowl;
      newHowl.play();
      setIsPlaying(true);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentTrack]);

  // 监听播放模式变化，更新 Howl 的 loop 属性
  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.loop(currentPlayMode === 'single');
    }
  }, [currentPlayMode]);

  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(volume);
    }
  }, [volume]);

  const handleTogglePlay = () => {
    if (!howlRef.current) return;

    if (isPlaying) {
      howlRef.current.pause();
      setIsPlaying(false);
    } else {
      howlRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePrevious = () => {
    if (howlRef.current) {
      howlRef.current.unload();
    }
    previous();
  };

  const handleNext = () => {
    if (howlRef.current) {
      howlRef.current.unload();
    }
    next();
  };

  const handleSeek = (value: number) => {
    if (howlRef.current) {
      howlRef.current.seek(value);
      updateProgress(value);
    }
  };

  const handleVolumeChange = (value: number) => {
    if (howlRef.current) {
      howlRef.current.volume(value);
    }
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
      case 'sequence':
        return <OrderedListOutlined />;
      case 'loop':
        return <RetweetOutlined />;
      case 'shuffle':
        return <SwapOutlined />;
      case 'single':
        return <ReloadOutlined />;
      default:
        return <OrderedListOutlined />;
    }
  };

  const getPlayModeText = () => {
    switch (playMode) {
      case 'sequence':
        return '顺序播放';
      case 'loop':
        return '列表循环';
      case 'shuffle':
        return '随机播放';
      case 'single':
        return '单曲循环';
      default:
        return '顺序播放';
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="player-container">
      <div className="player-content">
        <div className="player-track-info">
          {(() => {
            const coverSrc = currentTrack.cover_path
              ? trackService.getCoverUrl(currentTrack.cover_path)
              : (currentTrack as any).album_cover
                ? trackService.getCoverUrl((currentTrack as any).album_cover)
                : null;
            return coverSrc ? (
              <img
                src={coverSrc}
                alt={currentTrack.title}
                className="player-cover"
              />
            ) : null;
          })()}
          <div className="player-text">
            <div className="player-title">{currentTrack.title}</div>
            <div className="player-artist">
              {currentTrack.artists.map((a) => a.name).join(', ')}
            </div>
          </div>
        </div>

        <div className="player-controls">
          <Space size="large">
            <Tooltip title={getPlayModeText()}>
              <Button
                type="text"
                icon={getPlayModeIcon()}
                onClick={togglePlayMode}
                size="large"
              />
            </Tooltip>
            <Button
              type="text"
              icon={<StepBackwardOutlined />}
              onClick={handlePrevious}
              size="large"
            />
            <Button
              type="primary"
              shape="circle"
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleTogglePlay}
              size="large"
            />
            <Button
              type="text"
              icon={<StepForwardOutlined />}
              onClick={handleNext}
              size="large"
            />
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

        <div className="player-volume">
          <SoundOutlined />
          <Slider
            value={volume}
            min={0}
            max={1}
            step={0.01}
            onChange={handleVolumeChange}
            style={{ width: 100, marginLeft: 12 }}
          />
          <Tooltip title="播放队列">
            <Badge count={playlist.length} showZero>
              <Button
                type="text"
                icon={<UnorderedListOutlined />}
                onClick={() => setQueueVisible(true)}
                size="large"
                style={{ marginLeft: 16 }}
              />
            </Badge>
          </Tooltip>
        </div>
      </div>

      <PlayQueue visible={queueVisible} onClose={() => setQueueVisible(false)} />
    </div>
  );
};

export default Player;

