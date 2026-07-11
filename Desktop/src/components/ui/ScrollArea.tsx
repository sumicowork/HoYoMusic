import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import cn from './cn';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Scroll axis. */
  orientation?: 'vertical' | 'horizontal' | 'both';
}

const overflowMap = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
} as const;

/**
 * Scroll container with the native scrollbar hidden and a slim styled thumb
 * (see `.hym-scroll` in styles/global.css).
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ orientation = 'vertical', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('hym-scroll', overflowMap[orientation], className)}
      {...props}
    >
      {children}
    </div>
  ),
);

ScrollArea.displayName = 'ScrollArea';

export default ScrollArea;
