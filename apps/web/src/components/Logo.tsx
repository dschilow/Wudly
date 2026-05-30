import { cn } from '@/lib/utils';

/**
 * Wudly brand mark — a rounded tile with a subtle gradient and a "repeat/again"
 * glyph (the question is "would you buy it *again*"). Pure CSS/SVG, no asset.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-[28%] text-white shadow-sm',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(140deg, var(--color-accent) 0%, #6d5cf5 55%, #8b7bff 100%)',
      }}
      aria-hidden
    >
      {/* soft highlight */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 25% 10%, rgba(255,255,255,0.35), transparent 60%)',
        }}
      />
      <svg
        viewBox="0 0 24 24"
        width={size * 0.58}
        height={size * 0.58}
        fill="none"
        className="relative"
      >
        <path
          d="M4.5 9.5a7.5 7.5 0 1 1 1.6 4.6"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M4 5.5V10h4.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function LogoWord({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark size={32} />
      <span className="text-[1.15rem] font-extrabold tracking-tight text-ink">Wudly</span>
    </span>
  );
}
