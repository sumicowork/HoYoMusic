import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/components/ui';

/** Format seconds as `m:ss`. Returns `0:00` for missing/negative values. */
export function formatTime(sec?: number): string {
  const s = sec == null || !isFinite(sec) || sec < 0 ? 0 : sec;
  const m = Math.floor(s / 60);
  const rest = Math.floor(s % 60);
  return `${m}:${rest.toString().padStart(2, '0')}`;
}

export interface ProgressBarProps {
  /** Current playback position, in seconds. */
  currentSec: number;
  /** Total track duration, in seconds. */
  durationSec: number;
  /** Called with the new position (seconds) when the user seeks. */
  onSeek: (sec: number) => void;
  /** Show `current / total` time labels on each side of the bar. */
  showTimes?: boolean;
  className?: string;
}

/**
 * Controlled seek bar. Click or drag anywhere on the track to seek. The fill
 * and thumb are driven purely by `currentSec` / `durationSec`; all interaction
 * is reported back through `onSeek`.
 */
export function ProgressBar({
  currentSec,
  durationSec,
  onSeek,
  showTimes = true,
  className,
}: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pct =
    durationSec > 0 ? Math.min(100, Math.max(0, (currentSec / durationSec) * 100)) : 0;

  const secFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el || durationSec <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * durationSec;
  };

  const handleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (durationSec <= 0) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(secFromClientX(e.clientX));
  };

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    onSeek(secFromClientX(e.clientX));
  };

  const handleUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className={cn('flex w-full items-center gap-2', className)}>
      {showTimes && (
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--text-secondary)]">
          {formatTime(currentSec)}
        </span>
      )}
      <div
        ref={trackRef}
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationSec)}
        aria-valuenow={Math.round(currentSec)}
        tabIndex={0}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        className="group relative h-4 flex-1 cursor-pointer select-none touch-none"
      >
        {/* rail */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--surface-hover)]" />
        {/* fill */}
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent)]"
          style={{ width: `${pct}%` }}
        />
        {/* thumb */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100"
          style={{ left: `${pct}%` }}
        />
      </div>
      {showTimes && (
        <span className="w-10 shrink-0 text-xs tabular-nums text-[var(--text-secondary)]">
          {formatTime(durationSec)}
        </span>
      )}
    </div>
  );
}

export default ProgressBar;
