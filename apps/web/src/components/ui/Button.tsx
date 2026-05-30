import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** iOS variants + back-compat aliases for earlier call sites. */
type Variant =
  | 'filled'
  | 'tinted'
  | 'gray'
  | 'plain'
  | 'positive'
  | 'danger'
  // aliases:
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'outline'
  | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

/**
 * iOS-style button. Defaults to a filled blue "prominent" action; `tinted`/`gray`/
 * `plain` mirror UIButton configurations. Tap feedback dims opacity (iOS), no scale.
 */
const variantClasses: Record<Variant, string> = {
  filled: 'bg-accent text-white active:opacity-80',
  tinted: 'bg-accent-soft text-accent active:opacity-60',
  gray: 'bg-fill-2 text-label active:opacity-60',
  plain: 'bg-transparent text-accent active:opacity-40',
  positive: 'bg-positive text-white active:opacity-80',
  danger: 'bg-regret text-white active:opacity-80',
  // aliases
  primary: 'bg-accent text-white active:opacity-80',
  accent: 'bg-accent text-white active:opacity-80',
  secondary: 'bg-fill-2 text-label active:opacity-60',
  outline: 'bg-fill-2 text-label active:opacity-60',
  ghost: 'bg-transparent text-accent active:opacity-40',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-[0.9375rem] rounded-[var(--radius-md)] gap-1.5',
  md: 'h-11 px-5 text-[1.0625rem] rounded-[var(--radius-md)] gap-2',
  lg: 'h-[3.125rem] px-6 text-[1.0625rem] rounded-[var(--radius-lg)] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'filled', size = 'md', fullWidth, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-opacity duration-100',
        'disabled:pointer-events-none disabled:opacity-40',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-[1.1rem] w-[1.1rem] animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
