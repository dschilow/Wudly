import Link from 'next/link';
import { Lock } from 'lucide-react';

/** Standard "please sign in" panel used by gated flows. */
export function AuthGate({
  title,
  description,
  redirect,
}: {
  title: string;
  description: string;
  redirect: string;
}) {
  return (
    <div className="animate-rise mx-auto max-w-md pt-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
        <Lock className="h-6 w-6" strokeWidth={2} aria-hidden />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-muted-foreground">{description}</p>
      <Link
        href={`/login?redirect=${encodeURIComponent(redirect)}`}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        Anmelden / Registrieren
      </Link>
    </div>
  );
}
