import { Drawer } from 'antd';
import { CoverArt, EmptyState, ScrollArea, cn } from '@/components/ui';
import { usePlayerStore } from '@/store/playerStore';

export interface QueuePanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-in list of the playback queue. The current track is highlighted and
 * clicking any row jumps to it via `playIndex`.
 */
export function QueuePanel({ open, onClose }: QueuePanelProps) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const playIndex = usePlayerStore((s) => s.playIndex);

  return (
    <Drawer
      title="播放队列"
      placement="right"
      width={360}
      open={open}
      onClose={onClose}
      styles={{
        body: { padding: 0, background: 'var(--background-base)' },
        header: {
          background: 'var(--background-base)',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-primary)',
        },
        content: { background: 'var(--background-base)' },
      }}
    >
      {queue.length === 0 ? (
        <EmptyState title="队列为空" description="添加歌曲即可在此查看播放列表" />
      ) : (
        <ScrollArea className="h-full">
          {queue.map((track, i) => {
            const active = i === currentIndex;
            return (
              <button
                key={`${track.id}-${i}`}
                type="button"
                onClick={() => playIndex(i)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                  active
                    ? 'bg-[var(--surface-hover)]'
                    : 'hover:bg-[var(--surface)]',
                )}
              >
                <span
                  className={cn(
                    'w-5 shrink-0 text-right text-xs tabular-nums',
                    active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]',
                  )}
                >
                  {active ? '▶' : i + 1}
                </span>
                <CoverArt
                  coverUrl={track.coverUrl}
                  size={40}
                  radius="md"
                  alt={track.title}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate text-sm',
                      active
                        ? 'font-medium text-[var(--accent)]'
                        : 'text-[var(--text-primary)]',
                    )}
                  >
                    {track.title}
                  </div>
                  <div className="truncate text-xs text-[var(--text-secondary)]">
                    {track.artistName}
                  </div>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      )}
    </Drawer>
  );
}

export default QueuePanel;
