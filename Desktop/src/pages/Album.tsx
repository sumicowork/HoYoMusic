import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlayCircleOutlined } from '@ant-design/icons';
import { Button, Spin } from 'antd';
import { api, fetchAlbum, fetchAlbums } from '@/lib/api';
import { usePlayerStore } from '@/store/playerStore';
import type { Album } from '@/generated/api-types';
import { CoverArt, EmptyState } from '@/components/ui';
import { mapRawTrack, TrackList, type RawTrack } from './shared';

export default function Album() {
  const { id } = useParams();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<RawTrack[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Browse-all mode when no id is provided.
  const [allAlbums, setAllAlbums] = useState<Album[] | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setBrowseLoading(true);
      fetchAlbums().then((list) => {
        setAllAlbums(list);
        setBrowseLoading(false);
      });
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchAlbum(id),
      api.get<RawTrack[]>(`/albums/${id}/tracks`),
    ]).then(([a, ts]) => {
      if (!alive) return;
      setAlbum(a ?? null);
      setTracks(ts ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!id) {
    if (browseLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spin />
        </div>
      );
    }
    const list = allAlbums ?? [];
    return (
      <div>
        <h2 className="mb-4 text-xl font-bold text-[var(--text-primary)]">全部专辑</h2>
        {list.length === 0 ? (
          <EmptyState title="暂无专辑" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {list.map((a) => (
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
                {a.artistName && (
                  <p className="truncate text-xs text-[var(--text-secondary)]">
                    {a.artistName}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin />
      </div>
    );
  }

  if (!album) {
    return <EmptyState title="专辑加载失败" description="请稍后重试。" />;
  }

  const trackList = (tracks ?? []).map(mapRawTrack);

  const playAll = () => {
    if (trackList.length === 0) return;
    setQueue(trackList, 0);
    playIndex(0);
  };

  return (
    <div>
      <div className="mb-6 flex gap-5">
        <CoverArt
          coverUrl={album.coverUrl}
          alt={album.title}
          size={180}
          radius="lg"
          className="shrink-0 shadow-lg"
        />
        <div className="flex flex-col justify-end">
          <p className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">
            专辑
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
            {album.title}
          </h1>
          {album.artistName && (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {album.artistName}
            </p>
          )}
          {album.releaseDate && (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {album.releaseDate}
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

      {trackList.length === 0 ? (
        <EmptyState title="该专辑暂无曲目" />
      ) : (
        <TrackList tracks={trackList} />
      )}
    </div>
  );
}

