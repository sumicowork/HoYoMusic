import React, { useCallback } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { Link } from 'react-router-dom';
import { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import { formatDuration } from '../utils/format';
import { PlayCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

interface Props {
  tracks: Track[];
  height: number;
  onPlay?: (track: Track) => void;
}

const ITEM_HEIGHT = 56;

const VirtualTrackList: React.FC<Props> = ({ tracks, height, onPlay }) => {
  const { playTrackOnly, currentTrack } = usePlayerStore();

  const handlePlay = useCallback((track: Track) => {
    if (onPlay) onPlay(track);
    else playTrackOnly(track);
  }, [onPlay, playTrackOnly]);

  const RowComponent = useCallback(({ index, style }: RowComponentProps) => {
    const track = tracks[index];
    if (!track) return null;
    const isActive = currentTrack?.id === track.id;
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 12px',
          cursor: 'pointer',
          background: isActive ? 'var(--player-control-bg)' : 'transparent',
          borderBottom: '1px solid var(--border-tertiary)',
        }}
        onClick={() => handlePlay(track)}
      >
        <img
          src={getCoverUrl(track.cover_path || track.album_cover || null, undefined, true)}
          alt=""
          loading="lazy"
          onError={handleImageError}
          style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            color: isActive ? 'var(--ant-color-primary)' : 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: isActive ? 600 : 400,
          }}>
            <Link
              to={`/track/${track.id}`}
              onClick={(event) => event.stopPropagation()}
            >
              {track.title}
            </Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.album_id && track.album_title ? (
              <Link
                to={`/albums/${track.album_id}`}
                onClick={(event) => event.stopPropagation()}
              >
                {track.album_title}
              </Link>
            ) : (track.album_title || '')}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {formatDuration(track.duration)}
        </span>
        <PlayCircleOutlined style={{ fontSize: 18, color: 'var(--text-secondary)', flexShrink: 0 }} />
      </div>
    );
  }, [tracks, currentTrack, handlePlay]);

  if (tracks.length === 0) return null;

  return (
    <List<Record<string, never>>
      defaultHeight={height}
      rowCount={tracks.length}
      rowHeight={ITEM_HEIGHT}
      rowComponent={RowComponent}
      rowProps={{} as Record<string, never>}
      overscanCount={10}
      style={{ height }}
    />
  );
};

export default VirtualTrackList;




