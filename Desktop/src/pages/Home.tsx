import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircleFilled } from '@ant-design/icons';
import { Spin } from 'antd';
import { fetchHome, type HomeData } from '@/lib/api';
import { usePlayerStore } from '@/store/playerStore';
import type { Album, Playlist, Track } from '@/generated/api-types';
import { CoverArt, EmptyState } from '@/components/ui';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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
      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
        {title}
      </p>
      {subtitle && (
        <p className="truncate text-xs text-[var(--text-secondary)]">{subtitle}</p>
      )}
    </Link>
  );
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchHome().then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const playTracks = (tracks: Track[], idx: number) => {
    setQueue(tracks, idx);
    playIndex(idx);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  const tracks = data?.featuredTracks ?? [];
  const albums = data?.recentAlbums ?? [];
  const playlists = data?.playlists ?? [];

  return (
    <div className="space-y-10">
        {/* Recent / featured tracks */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-[var(--text-primary)]">
            推荐单曲
          </h2>
          {tracks.length === 0 ? (
            <EmptyState title="暂无推荐单曲" />
          ) : (
            <div className="space-y-1">
              {tracks.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => playTracks(tracks, i)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface)]"
                >
                  <PlayCircleFilled className="text-lg text-[var(--accent)]" />
                  <CoverArt
                    coverUrl={t.coverUrl}
                    alt={t.title}
                    size={40}
                    radius="md"
                  />
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
          )}
        </section>

        {/* Featured albums */}
        <SectionGrid
          title="精选专辑"
          empty={albums.length === 0}
          emptyText="暂无专辑"
        >
          {albums.map((a: Album) => (
            <CoverCard
              key={a.id}
              to={`/album/${a.id}`}
              coverUrl={a.coverUrl}
              title={a.title}
              subtitle={a.artistName}
            />
          ))}
        </SectionGrid>

        {/* Playlists */}
        <SectionGrid
          title="推荐歌单"
          empty={playlists.length === 0}
          emptyText="暂无歌单"
        >
          {playlists.map((p: Playlist) => (
            <CoverCard
              key={p.id}
              to={`/playlist/${p.id}`}
              coverUrl={p.coverUrl}
              title={p.name}
              subtitle={p.trackCount ? `${p.trackCount} 首` : undefined}
            />
          ))}
        </SectionGrid>
      </div>
  );
}

function SectionGrid({
  title,
  empty,
  emptyText,
  children,
}: {
  title: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-[var(--text-primary)]">{title}</h2>
      {empty ? (
        <EmptyState title={emptyText} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {children}
        </div>
      )}
    </section>
  );
}
