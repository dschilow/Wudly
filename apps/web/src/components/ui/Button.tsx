import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'positive' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  accent: 'bg-accent text-white hover:bg-accent-hover shadow-[var(--shadow-glow)]',
  secondary: 'bg-surface text-ink border border-border-strong hover:bg-surface-sunken shadow-xs',
  outline: 'bg-transparent text-ink border border-border-strong hover:bg-surface-sunken',
  ghost: 'bg-transparent text-muted-foreground hover:bg-surface-sunken hover:text-ink',
  positive: 'bg-positive text-white hover:brightness-105 shadow-sm',
  danger: 'bg-regret text-white hover:brightness-105 shadow-sm',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.8rem] rounded-[var(--radius-md)] gap-1.5',
  md: 'h-11 px-5 text-sm rounded-[var(--radius-lg)] gap-2',
  lg: 'h-[3.25rem] px-6 text-[0.95rem] rounded-[var(--radius-xl)] gap-2',
};

/** Primary interactive button. Large, comfortable tap targets; subtle press feedback. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-200 ease-[var(--ease-out-soft)]',
        'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
