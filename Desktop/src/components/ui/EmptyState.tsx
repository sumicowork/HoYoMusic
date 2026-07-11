import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import cn from './cn';

export interface EmptyStateProps {
  /** Optional icon node (defaults to a music note). */
  icon?: ReactNode;
  /** Primary message. */
  title: string;
  /** Secondary, muted description. */
  description?: string;
  /** Optional action (e.g. a Button). */
  action?: ReactNode;
  className?: string;
}

/**
 * Centered empty / no-results placeholder.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="text-[var(--text-secondary)] opacity-70">
        {icon ?? (
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-[var(--text-secondary)]">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  ),
);

EmptyState.displayName = 'EmptyState';

export default EmptyState;
