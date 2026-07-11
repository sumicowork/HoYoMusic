import { useState } from 'react';
import {
  CaretRightFilled,
  PauseOutlined,
  ReloadOutlined,
  RetweetOutlined,
  SwapOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { CoverArt, IconButton, cn } from '@/components/ui';
import { usePlayerStore } from '@/store/playerStore';
import { ProgressBar, formatTime } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { QueuePanel } from './QueuePanel';

export interface PlayerBarProps {
  className?: string;
}

/**
 * Fixed bottom playback bar: cover + meta, transport controls (shuffle /
 * prev / play-pause / next / repeat), a seekable progress bar, volume and a
 * queue button that opens the QueuePanel.
 *
 * This component is UI-only: it reads/writes the player store. The native
 * bridges (OS media session, global shortcuts, tray) live in the `use*`
 * hooks mounted by `AppShell`, so media actions are not wired here.
 */
export function PlayerBar({ className }: PlayerBarProps) {
  const current = usePlayerStore((s) => s.current());
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progressSec = usePlayerStore((s) => s.progressSec);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const seek = usePlayerStore((s) => s.seek);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  const [queueOpen, setQueueOpen] = useState(false);

  const repeatIcon = repeat === 'one' ? <ReloadOutlined /> : <RetweetOutlined />;
  const repeatActive = repeat !== 'off';

  // NOTE: OS media-session metadata/state and native media actions are now
  // owned by the `useMediaSession` hook (mounted in AppShell), so they are not
  // wired here to avoid handling the same action twice.

  return (
    <>
      <div
        className={cn(
          'flex h-full w-full items-center gap-4 px-4 py-2',
          className,
        )}
      >
        {/* Left: cover + meta */}
        <div className="flex w-[240px] min-w-0 items-center gap-3">
          <CoverArt
            coverUrl={current?.coverUrl}
            size={48}
            radius="md"
            alt={current?.title}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[var(--text-primary)]">
              {current?.title ?? '未播放'}
            </div>
            <div className="truncate text-xs text-[var(--text-secondary)]">
              {current?.artistName ?? ''}
            </div>
          </div>
        </div>

        {/* Center: controls + progress */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <IconButton
              aria-label="随机播放"
              size="sm"
              variant={shuffle ? 'accent' : 'ghost'}
              icon={<SwapOutlined />}
              onClick={toggleShuffle}
            />
            <IconButton
              aria-label="上一首"
              size="md"
              variant="ghost"
              icon={<StepBackwardOutlined />}
              onClick={playPrev}
            />
            <IconButton
              aria-label={isPlaying ? '暂停' : '播放'}
              size="lg"
              variant="accent"
              icon={isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
              onClick={togglePlay}
            />
            <IconButton
              aria-label="下一首"
              size="md"
              variant="ghost"
              icon={<StepForwardOutlined />}
              onClick={playNext}
            />
            <IconButton
              aria-label="循环模式"
              size="sm"
              variant={repeatActive ? 'accent' : 'ghost'}
              icon={repeatIcon}
              onClick={cycleRepeat}
            />
          </div>

          <div className="flex w-full max-w-2xl items-center gap-2">
            <ProgressBar
              currentSec={progressSec}
              durationSec={current?.durationSec ?? 0}
              onSeek={seek}
            />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--text-secondary)]">
              {formatTime(current?.durationSec)}
            </span>
          </div>
        </div>

        {/* Right: volume + queue */}
        <div className="flex w-[200px] items-center justify-end gap-2">
          <VolumeControl />
          <IconButton
            aria-label="播放队列"
            size="sm"
            variant="ghost"
            icon={<UnorderedListOutlined />}
            onClick={() => setQueueOpen(true)}
          />
        </div>
      </div>

      <QueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />
    </>
  );
}

export default PlayerBar;
