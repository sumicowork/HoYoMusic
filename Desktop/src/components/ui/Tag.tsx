import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import cn from './cn';

export interface TagProps {
  children: ReactNode;
  /** `accent` uses the brand color; `muted` is a neutral pill. */
  tone?: 'accent' | 'muted';
  className?: string;
}

/**
 * Small pill used for genres, badges and status (e.g. "Explicit", "Lossless").
 */
export const Tag = forwardRef<HTMLSpanElement, TagProps>(
  ({ children, tone = 'muted', className }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ' +
          'leading-none border',
        tone === 'accent'
          ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30'
          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]',
        className,
      )}
    >
      {children}
    </span>
  ),
);

Tag.displayName = 'Tag';

export default Tag;
