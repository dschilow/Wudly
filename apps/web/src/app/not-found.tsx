import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-[1.5rem] font-bold text-label">Seite nicht gefunden</h1>
      <p className="mt-2 text-[1.0625rem] text-muted-foreground">
        Diese Seite oder dieses Produkt gibt es (noch) nicht.
      </p>
      <Link
        href="/"
        className="tap-dim mt-7 inline-flex h-[3.125rem] items-center rounded-[var(--radius-md)] bg-accent px-7 text-[1.0625rem] font-semibold text-white"
      >
        Zur Startseite
      </Link>
    </div>
  );
}
