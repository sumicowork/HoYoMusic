import { usePlayerStore } from '@/store/playerStore';
import { Card, CoverArt, EmptyState, cn } from '@/components/ui';
import { WaveformVisualizer } from './WaveformVisualizer';

export interface NowPlayingProps {
  className?: string;
}

/**
 * Large, centered "now playing" panel: big cover art, title / artist / album,
 * and an animated waveform that reacts to playback state. Reads everything
 * from the player store.
 */
export function NowPlaying({ className }: NowPlayingProps) {
  const current = usePlayerStore((s) => s.current());
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  if (!current) {
    return (
      <Card flush className={cn('flex items-center justify-center p-8', className)}>
        <EmptyState title="未在播放" description="选择一首歌曲开始欣赏" />
      </Card>
    );
  }

  return (
    <Card
      flush
      className={cn(
        'flex flex-col items-center gap-6 p-8 text-center',
        className,
      )}
    >
      <CoverArt
        coverUrl={current.coverUrl}
        size={280}
        radius="lg"
        alt={current.title}
        className="shadow-[0_20px_60px_-20px_rgba(127,119,221,0.55)]"
      />

      <div className="min-w-0">
        <h2 className="truncate text-2xl font-bold text-[var(--text-primary)]">
          {current.title}
        </h2>
        <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
          {current.artistName}
          {current.albumTitle ? ` · ${current.albumTitle}` : ''}
        </p>
      </div>

      <div className="w-full max-w-md">
        <WaveformVisualizer isPlaying={isPlaying} />
      </div>
    </Card>
  );
}

export default NowPlaying;
