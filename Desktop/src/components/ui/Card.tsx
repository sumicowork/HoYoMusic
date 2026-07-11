import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import cn from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift and brighten on hover. */
  interactive?: boolean;
  /** Optional content rendered in a padded header row. */
  header?: ReactNode;
  /** Remove inner padding (useful for media-filled cards). */
  flush?: boolean;
}

/**
 * Raised surface container. Used for track rows, album tiles and panels.
 * Applies the dark surface token and an optional hover lift.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive, header, flush, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] ' +
          'text-[var(--text-primary)] transition-all duration-200',
        interactive && 'hover:-translate-y-0.5 hover:bg-[var(--surface-hover)] ' +
          'hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] cursor-pointer',
        className,
      )}
      {...props}
    >
      {header && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">{header}</div>
      )}
      <div className={cn(!flush && 'p-4')}>{children}</div>
    </div>
  ),
);

Card.displayName = 'Card';

export default Card;
