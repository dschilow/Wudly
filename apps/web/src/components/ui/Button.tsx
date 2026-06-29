import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Verdict variants + back-compat aliases for earlier call sites. */
type Variant =
  | 'filled'
  | 'brand'
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
 * Verdict button. `filled` is a clean neutral primary (ink on light, light on
 * ink) with guaranteed contrast; `brand`/`accent` is the luminous signature CTA
 * with an accent glow, used deliberately. Tap feedback = tactile press + dim.
 */
const variantClasses: Record<Variant, string> = {
  filled: 'bg-primary text-primary-foreground shadow-sm active:opacity-90',
  brand: 'brand-gradient text-white shadow-[var(--shadow-glow)] active:opacity-95',
  tinted: 'bg-accent-soft text-accent-ink active:opacity-70',
  gray: 'bg-fill-2 text-label active:opacity-70',
  plain: 'bg-transparent text-accent-ink active:opacity-50',
  positive: 'bg-positive text-white active:opacity-85',
  danger: 'bg-regret text-white active:opacity-85',
  // aliases
  primary: 'bg-primary text-primary-foreground shadow-sm active:opacity-90',
  accent: 'brand-gradient text-white shadow-[var(--shadow-glow)] active:opacity-95',
  secondary: 'bg-fill-2 text-label active:opacity-70',
  outline:
    'bg-transparent text-label shadow-[inset_0_0_0_1px_var(--color-border-strong)] active:opacity-70',
  ghost: 'bg-transparent text-accent-ink active:opacity-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-[0.9rem] rounded-[var(--radius-md)] gap-1.5',
  md: 'h-11 px-5 text-[1rem] rounded-[var(--radius-lg)] gap-2',
  lg: 'h-[3.25rem] px-6 text-[1.0625rem] rounded-[var(--radius-lg)] gap-2',
};

const ButtonRoot = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'filled', size = 'md', fullWidth, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'press inline-flex select-none items-center justify-center font-semibold transition',
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

export const Button = ButtonRoot;
