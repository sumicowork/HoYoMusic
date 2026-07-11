import { PlayCircleFilled } from '@ant-design/icons';
import { usePlayerStore } from '@/store/playerStore';
import { api, fetchCoverUrl } from '@/lib/api';
import type { Track } from '@/generated/api-types';
import { CoverArt } from '@/components/ui';

/** Minimal raw track shape returned by backend list endpoints. */
export interface RawTrack {
  id: number | string;
  title?: string;
  artist_name?: string;
  artistName?: string;
  album_title?: string;
  albumTitle?: string;
  duration?: number;
  cover_path?: string | null;
  coverUrl?: string;
  audio_url?: string;
}

/** Map a raw backend track into the friendly frontend Track type. */
export function mapRawTrack(r: RawTrack): Track {
  return {
    id: String(r.id),
    title: r.title ?? '',
    artistName: r.artist_name ?? r.artistName ?? '未知艺术家',
    albumTitle: r.album_title ?? r.albumTitle,
    coverUrl: fetchCoverUrl(r.cover_path ?? r.coverUrl),
    durationSec: r.duration ?? 0,
    audioUrl: r.audio_url ?? `${api.base}/public/tracks/${r.id}/stream`,
  };
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TrackListProps {
  tracks: Track[];
}

/**
 * Clickable track rows. Clicking a row sets the global queue to the full list
 * starting at that index and begins playback.
 */
export function TrackList({ tracks }: TrackListProps) {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const currentId = usePlayerStore((s) => s.current()?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const play = (idx: number) => {
    setQueue(tracks, idx);
    playIndex(idx);
  };

  return (
    <div className="space-y-1">
      {tracks.map((t, i) => {
        const active = t.id === currentId;
        return (
          <button
            key={t.id}
            onClick={() => play(i)}
            className={[
              'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface)]',
              active ? 'bg-[var(--accent)]/10' : '',
            ].join(' ')}
          >
            <span className="w-5 text-center text-xs tabular-nums text-[var(--text-secondary)]">
              {active && isPlaying ? (
                <PlayCircleFilled className="text-[var(--accent)]" />
              ) : (
                i + 1
              )}
            </span>
            <CoverArt coverUrl={t.coverUrl} alt={t.title} size={40} radius="md" />
            <div className="min-w-0 flex-1">
              <p
                className={[
                  'truncate text-sm font-medium',
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]',
                ].join(' ')}
              >
                {t.title}
              </p>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {t.artistName}
              </p>
            </div>
            {t.albumTitle && (
              <span className="hidden truncate text-xs text-[var(--text-secondary)] md:block md:w-48">
                {t.albumTitle}
              </span>
            )}
            <span className="text-xs tabular-nums text-[var(--text-secondary)]">
              {formatTime(t.durationSec)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
