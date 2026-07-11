import { forwardRef } from 'react';
import { Button as AntButton } from 'antd';
import type { ButtonProps as AntButtonProps } from 'antd';
import cn from './cn';

export type ButtonVariant = 'accent' | 'ghost' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<AntButtonProps, 'size' | 'variant'> {
  /** Visual style. `accent` is the primary brand button. */
  variant?: ButtonVariant;
  /** Control density. */
  size?: ButtonSize;
  /** Stretch to fill the container width. */
  block?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium select-none ' +
  'rounded-md transition-all duration-150 outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';

const sizeMap: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const variantMap: Record<ButtonVariant, string> = {
  accent:
    'bg-[var(--accent)] text-white border border-transparent ' +
    'hover:brightness-110 hover:shadow-[0_6px_20px_-6px_var(--accent)]',
  ghost:
    'bg-transparent text-[var(--text-primary)] border border-[var(--border)] ' +
    'hover:bg-[var(--surface-hover)] hover:border-[var(--border)]',
  subtle:
    'bg-[var(--surface)] text-[var(--text-primary)] border border-transparent ' +
    'hover:bg-[var(--surface-hover)]',
};

/**
 * Primary action button. Wraps Ant Design's Button for robust interaction
 * behaviour while applying the HoYoMusic dark theme via Tailwind tokens.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'accent', size = 'md', block, className, ...props }, ref) => (
    <AntButton
      ref={ref as never}
      className={cn(base, sizeMap[size], variantMap[variant], block && 'w-full', className)}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export default Button;
