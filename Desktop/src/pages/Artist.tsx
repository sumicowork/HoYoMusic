import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlayCircleOutlined } from '@ant-design/icons';
import { Button, Spin } from 'antd';
import { fetchArtist } from '@/lib/api';
import { usePlayerStore } from '@/store/playerStore';
import type { Album, Artist, Track } from '@/generated/api-types';
import { CoverArt, EmptyState } from '@/components/ui';
import { TrackList } from './shared';

export default function Artist() {
  const { id } = useParams();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetchArtist(id).then((bundle) => {
      if (!alive) return;
      setArtist(bundle?.artist ?? null);
      setAlbums(bundle?.albums ?? null);
      setTracks(bundle?.tracks ?? null);
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

  if (!artist) {
    return <EmptyState title="艺术家加载失败" description="请稍后重试。" />;
  }

  const albumList = albums ?? [];
  const trackList = tracks ?? [];

  const playAll = () => {
    if (trackList.length === 0) return;
    setQueue(trackList, 0);
    playIndex(0);
  };

  return (
    <div>
      <div className="mb-6 flex gap-5">
        <CoverArt
          coverUrl={artist.coverUrl}
          alt={artist.name}
          size={180}
          radius="xl"
          className="shrink-0 shadow-lg"
        />
        <div className="flex flex-col justify-end">
          <p className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">
            艺术家
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
            {artist.name}
          </h1>
          {artist.bio && (
            <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
              {artist.bio}
            </p>
          )}
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

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-[var(--text-primary)]">专辑</h2>
        {albumList.length === 0 ? (
          <EmptyState title="暂无专辑" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {albumList.map((a) => (
              <Link key={a.id} to={`/album/${a.id}`} className="group block">
                <CoverArt
                  coverUrl={a.coverUrl}
                  alt={a.title}
                  radius="lg"
                  className="mb-2 transition-transform duration-200 group-hover:scale-105"
                />
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {a.title}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-[var(--text-primary)]">单曲</h2>
        {trackList.length === 0 ? (
          <EmptyState title="暂无单曲" />
        ) : (
          <TrackList tracks={trackList} />
        )}
      </section>
    </div>
  );
}
