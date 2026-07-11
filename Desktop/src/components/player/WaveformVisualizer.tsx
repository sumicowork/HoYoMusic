import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui';

export interface WaveformVisualizerProps {
  /** When true the bars animate; when false they settle to a calm idle. */
  isPlaying: boolean;
  /** Number of bars. */
  bars?: number;
  className?: string;
}

/**
 * Decorative, animated equalizer. Heights are driven by requestAnimationFrame
 * (sine waves + a touch of noise) so it reacts to `isPlaying` without any
 * audio analysis — purely visual flavor for the Now Playing panel.
 */
export function WaveformVisualizer({
  isPlaying,
  bars = 28,
  className,
}: WaveformVisualizerProps) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const animate = () => {
      const t = performance.now() / 1000;
      barRefs.current.forEach((bar, i) => {
        if (!bar) return;
        const react = isPlaying
          ? (Math.sin(t * 3 + i * 0.5) * 0.5 + 0.5) * 70 +
            Math.sin(t * 7 + i) * 8 +
            Math.random() * 8
          : 10 + Math.sin(i * 0.8) * 4;
        const h = Math.max(8, Math.min(100, react));
        bar.style.height = `${h}%`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  return (
    <div
      className={cn(
        'flex h-16 w-full items-end justify-center gap-[3px]',
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="w-[3px] rounded-full bg-[var(--accent)]/80"
          style={{ height: '12%' }}
        />
      ))}
    </div>
  );
}

export default WaveformVisualizer;
