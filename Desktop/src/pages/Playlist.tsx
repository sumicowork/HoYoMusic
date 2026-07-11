import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlayCircleOutlined } from '@ant-design/icons';
import { Button, Spin } from 'antd';
import { fetchPlaylist } from '@/lib/api';
import { usePlayerStore } from '@/store/playerStore';
import type { Playlist, Track } from '@/generated/api-types';
import { CoverArt, EmptyState } from '@/components/ui';
import { TrackList } from './shared';

export default function Playlist() {
  const { id } = useParams();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetchPlaylist(id).then((p) => {
      if (!alive) return;
      setPlaylist(p ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!id || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin />
      </div>
    );
  }

  if (!playlist) {
    return <EmptyState title="歌单加载失败" description="请稍后重试。" />;
  }

  const trackList: Track[] = playlist.tracks ?? [];

  const playAll = () => {
    if (trackList.length === 0) return;
    setQueue(trackList, 0);
    playIndex(0);
  };

  return (
    <div>
      <div className="mb-6 flex gap-5">
        <CoverArt
          coverUrl={playlist.coverUrl}
          alt={playlist.name}
          size={180}
          radius="lg"
          className="shrink-0 shadow-lg"
        />
        <div className="flex flex-col justify-end">
          <p className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">
            歌单
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
              {playlist.description}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {trackList.length} 首
            {playlist.totalDuration
              ? ` · ${Math.round(playlist.totalDuration / 60)} 分钟`
              : ''}
          </p>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={playAll}
            disabled={trackList.length === 0}
            className="mt-4 w-fit"
          >
            播放全部
          </Button>
        </div>
      </div>

      {trackList.length === 0 ? (
        <EmptyState title="该歌单暂无曲目" />
      ) : (
        <TrackList tracks={trackList} />
      )}
    </div>
  );
}
