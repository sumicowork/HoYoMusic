import type { CSSProperties } from 'react';
import { forwardRef } from 'react';
import cn from './cn';

export interface SkeletonProps {
  /** Width — number (px) or any CSS value. */
  width?: number | string;
  /** Height — number (px) or any CSS value. */
  height?: number | string;
  /** Border radius preset. */
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  style?: CSSProperties;
}

const radiusMap = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
} as const;

/**
 * Shimmering placeholder block. The shimmer animation is defined in
 * styles/global.css (`.hym-skeleton`).
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ width, height, radius = 'md', className, style }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cn('hym-skeleton bg-[var(--surface)]', radiusMap[radius], className)}
      style={{ width, height, ...style }}
    />
  ),
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;
