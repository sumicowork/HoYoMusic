import { CaretRightFilled, PauseOutlined } from '@ant-design/icons';
import { CoverArt, IconButton, cn } from '@/components/ui';
import { usePlayerStore } from '@/store/playerStore';

export interface MiniPlayerProps {
  className?: string;
}

/**
 * Compact player: cover thumbnail + title + a single play/pause button.
 * Handy for sidebars or overlay chips. Driven entirely by the store.
 */
export function MiniPlayer({ className }: MiniPlayerProps) {
  const current = usePlayerStore((s) => s.current());
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-full border border-[var(--border)] ' +
          'bg-[var(--surface)] px-2 py-1.5',
        className,
      )}
    >
      <CoverArt
        coverUrl={current?.coverUrl}
        size={40}
        radius="md"
        alt={current?.title}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--text-primary)]">
          {current?.title ?? '未播放'}
        </div>
        <div className="truncate text-xs text-[var(--text-secondary)]">
          {current?.artistName ?? ''}
        </div>
      </div>
      <IconButton
        aria-label={isPlaying ? '暂停' : '播放'}
        variant="accent"
        size="sm"
        icon={isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
        onClick={togglePlay}
      />
    </div>
  );
}

export default MiniPlayer;
