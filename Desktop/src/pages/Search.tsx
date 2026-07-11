import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlayCircleFilled, SearchOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import { searchTracks } from '@/lib/api';
import { usePlayerStore } from '@/store/playerStore';
import type { Track } from '@/generated/api-types';
import { CoverArt, EmptyState } from '@/components/ui';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';

  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  useEffect(() => {
    if (!q) {
      setTracks(null);
      return;
    }
    let alive = true;
    setLoading(true);
    searchTracks(q).then((res) => {
      if (!alive) return;
      setTracks(res);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [q]);

  const playTracks = (list: Track[], idx: number) => {
    setQueue(list, idx);
    playIndex(idx);
  };

  if (!q) {
    return (
      <EmptyState
        icon={<SearchOutlined />}
        title="搜索音乐"
        description="在顶部搜索栏输入歌曲名或艺术家开始搜索。"
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin />
      </div>
    );
  }

  const results = tracks ?? [];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        搜索 “{q}” · {results.length} 个结果
      </h2>
      {results.length === 0 ? (
        <EmptyState title="未找到相关单曲" description="试试其他关键词。" />
      ) : (
        <div className="space-y-1">
          {results.map((t, i) => (
            <button
              key={t.id}
              onClick={() => playTracks(results, i)}
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
      )}
    </div>
  );
}
