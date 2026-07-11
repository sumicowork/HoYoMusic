import { forwardRef } from 'react';
import { Button as AntButton } from 'antd';
import type { ButtonProps as AntButtonProps } from 'antd';
import type { ReactNode } from 'react';
import cn from './cn';

export interface IconButtonProps extends Omit<AntButtonProps, 'size' | 'icon' | 'variant'> {
  /** The icon element to render. */
  icon: ReactNode;
  /** Visual style. */
  variant?: 'accent' | 'ghost' | 'subtle';
  /** Control density. */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label — required since the button is icon-only. */
  'aria-label': string;
}

const sizeMap = {
  sm: 'h-8 w-8 text-base',
  md: 'h-10 w-10 text-lg',
  lg: 'h-12 w-12 text-xl',
} as const;

const variantMap = {
  accent: 'bg-[var(--accent)] text-white hover:brightness-110',
  ghost:
    'bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
  subtle:
    'bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
} as const;

/** Square/circular icon-only button. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, variant = 'ghost', size = 'md', className, ...props }, ref) => (
    <AntButton
      ref={ref as never}
      type="text"
      className={cn(
        'inline-flex items-center justify-center rounded-full p-0 ' +
          'border border-transparent transition-all duration-150 active:scale-90 ' +
          'disabled:opacity-40 disabled:cursor-not-allowed',
        sizeMap[size],
        variantMap[variant],
        className,
      )}
      icon={icon}
      {...props}
    />
  ),
);

IconButton.displayName = 'IconButton';

export default IconButton;
