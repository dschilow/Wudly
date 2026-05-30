import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-6xl" aria-hidden>
        🧭
      </div>
      <h1 className="mt-4 text-2xl font-black text-ink">Seite nicht gefunden</h1>
      <p className="mt-2 text-muted-foreground">
        Diese Seite oder dieses Produkt gibt es (noch) nicht.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
      >
        Zur Startseite
      </Link>
    </div>
  );
}
