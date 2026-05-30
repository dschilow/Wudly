import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-surface-sunken text-muted-foreground">
        <Compass className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">Seite nicht gefunden</h1>
      <p className="mt-2 text-muted-foreground">
        Diese Seite oder dieses Produkt gibt es (noch) nicht.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-[var(--radius-lg)] bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        Zur Startseite
      </Link>
    </div>
  );
}
