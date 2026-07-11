import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircleFilled } from '@ant-design/icons';
import { Spin, Tabs } from 'antd';
import {
  fetchAlbums,
  fetchArtists,
  fetchPlaylists,
  fetchTracks,
} from '@/lib/api';
import { usePlayerStore } from '@/store/playerStore';
import type { Album, Artist, Playlist, Track } from '@/generated/api-types';
import { CoverArt, EmptyState } from '@/components/ui';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => {
      if (alive) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading };
}

function CoverCard({
  to,
  coverUrl,
  title,
  subtitle,
}: {
  to: string;
  coverUrl?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link to={to} className="group block">
      <CoverArt
        coverUrl={coverUrl}
        alt={title}
        radius="lg"
        className="mb-2 transition-transform duration-200 group-hover:scale-105"
      />
      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{title}</p>
      {subtitle && (
        <p className="truncate text-xs text-[var(--text-secondary)]">{subtitle}</p>
      )}
    </Link>
  );
}

export default function Library() {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  const tracks = useAsync<Track[]>(() => fetchTracks(), []);
  const albums = useAsync<Album[]>(() => fetchAlbums(), []);
  const artists = useAsync<Artist[]>(() => fetchArtists(), []);
  const playlists = useAsync<Playlist[]>(() => fetchPlaylists(), []);

  const playTracks = (list: Track[], idx: number) => {
    setQueue(list, idx);
    playIndex(idx);
  };

  const gridClass =
    'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

  const tabs = [
    {
      key: 'tracks',
      label: '单曲',
      children: tracks.loading ? (
        <CenterSpin />
      ) : (tracks.data ?? []).length === 0 ? (
        <EmptyState title="乐库暂无单曲" />
      ) : (
        <div className="space-y-1">
          {(tracks.data ?? []).map((t, i) => (
            <button
              key={t.id}
              onClick={() => playTracks(tracks.data ?? [], i)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface)]"
            >
              <PlayCircleFilled className="text-lg text-[var(--accent)]" />
              <CoverArt coverUrl={t.coverUrl} alt={t.title} size={40} radius="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {t.title}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {t.artistName}
                </p>
              </div>
              <span className="text-xs tabular-nums text-[var(--text-secondary)]">
                {formatTime(t.durationSec)}
              </span>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'albums',
      label: '专辑',
      children: albums.loading ? (
        <CenterSpin />
      ) : (albums.data ?? []).length === 0 ? (
        <EmptyState title="暂无专辑" />
      ) : (
        <div className={gridClass}>
          {(albums.data ?? []).map((a) => (
            <CoverCard
              key={a.id}
              to={`/album/${a.id}`}
              coverUrl={a.coverUrl}
              title={a.title}
              subtitle={a.artistName}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'artists',
      label: '艺术家',
      children: artists.loading ? (
        <CenterSpin />
      ) : (artists.data ?? []).length === 0 ? (
        <EmptyState title="暂无艺术家" />
      ) : (
        <div className={gridClass}>
          {(artists.data ?? []).map((a) => (
            <CoverCard
              key={a.id}
              to={`/artist/${encodeURIComponent(a.id)}`}
              coverUrl={a.coverUrl}
              title={a.name}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'playlists',
      label: '歌单',
      children: playlists.loading ? (
        <CenterSpin />
      ) : (playlists.data ?? []).length === 0 ? (
        <EmptyState title="暂无歌单" />
      ) : (
        <div className={gridClass}>
          {(playlists.data ?? []).map((p) => (
            <CoverCard
              key={p.id}
              to={`/playlist/${p.id}`}
              coverUrl={p.coverUrl}
              title={p.name}
              subtitle={p.trackCount ? `${p.trackCount} 首` : undefined}
            />
          ))}
        </div>
      ),
    },
  ];

  return <Tabs defaultActiveKey="tracks" items={tabs} />;
}

function CenterSpin() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spin />
    </div>
  );
}
