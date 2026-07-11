import { forwardRef, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import cn from './cn';
import { Skeleton } from './Skeleton';

export interface CoverArtProps {
  /** Direct image URL. Takes precedence over `fetchCoverUrl`. */
  coverUrl?: string;
  /** Async resolver for the cover URL (e.g. wrapping a `fetchCoverUrl` helper). */
  fetchCoverUrl?: () => Promise<string>;
  /** Accessible alt text. */
  alt?: string;
  /** Square size — number (px) or any CSS value. */
  size?: number | string;
  /** Border radius preset. */
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: CSSProperties;
}

const radiusMap = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
} as const;

function MusicNoteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-[var(--text-secondary)]">
      <svg
        width="42%"
        height="42%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </div>
  );
}

/**
 * Square, rounded album/track cover. Shows a shimmer while loading and falls
 * back to a music-note placeholder on error or empty source.
 */
export const CoverArt = forwardRef<HTMLDivElement, CoverArtProps>(
  ({ coverUrl, fetchCoverUrl, alt = '', size = '100%', radius = 'md', className, style }, ref) => {
    const [src, setSrc] = useState<string | undefined>(coverUrl);
    const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
      coverUrl ? 'loading' : 'error',
    );

    useEffect(() => {
      if (coverUrl) {
        setSrc(coverUrl);
        setStatus('loading');
        return;
      }
      if (!fetchCoverUrl) {
        setStatus('error');
        return;
      }
      let alive = true;
      setStatus('loading');
      fetchCoverUrl()
        .then((url) => {
          if (!alive) return;
          setSrc(url);
          setStatus('loading');
        })
        .catch(() => alive && setStatus('error'));
      return () => {
        alive = false;
      };
    }, [coverUrl, fetchCoverUrl]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden bg-[var(--surface)] shrink-0',
          radiusMap[radius],
          className,
        )}
        style={{ width: size, height: size, ...style }}
      >
        {status === 'loading' && <Skeleton radius={radius} className="absolute inset-0 h-full w-full" />}
        {status === 'error' && <MusicNoteFallback />}
        {status === 'loaded' && src && (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setStatus('error')}
            className="h-full w-full object-cover"
          />
        )}
      </div>
    );
  },
);

CoverArt.displayName = 'CoverArt';

export default CoverArt;
