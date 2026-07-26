import { type ComponentPropsWithoutRef, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * `Button` — structural button primitive.
 * - Always `type="button"` by default (form-safe).
 * - `variant` and `size` are exposed so the upcoming visual design can
 *   map them to classes without changing the call sites.
 * - `forwardRef` so parent components (e.g. tooltips, focus managers)
 *   can attach refs.
 *
 * NOTE: No decorative styling is applied. Only structural sizing
 * (padding, font-size) is set so variants are visually distinguishable
 * as buttons; the visual design will refine colors, hover, etc.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      data-size={size}
      className={cn(
        'inline-flex items-center justify-center font-medium',
        sizeClass(size),
        className,
      )}
      {...rest}
    />
  );
});

function sizeClass(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return 'text-sm px-3 py-1.5';
    case 'lg':
      return 'text-lg px-6 py-3';
    case 'md':
    default:
      return 'text-base px-4 py-2';
  }
}
