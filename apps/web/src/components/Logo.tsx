import { cn } from '@/lib/utils';

/**
 * Wudly app mark — a clean iOS "app icon" squircle in the system blue with a
 * simple repeat/again glyph (the question is "would you buy it *again*").
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center bg-accent text-white shadow-[var(--shadow-glow)]',
        className,
      )}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
        <path d="M5 10a7 7 0 1 1 1.2 4" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M4.5 5.5V10H9"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function LogoWord({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="font-display text-[1.75rem] font-semibold leading-none text-accent">
        Wudly
      </span>
    </span>
  );
}
