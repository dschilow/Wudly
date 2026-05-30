import Link from 'next/link';

/** Standard "please sign in" panel used by gated flows — iOS-quiet. */
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
    <div className="animate-fade mx-auto max-w-md px-2 pt-16 text-center">
      <h1 className="text-[1.75rem] font-bold tracking-tight text-label">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-[1.0625rem] leading-snug text-muted-foreground">
        {description}
      </p>
      <Link
        href={`/login?redirect=${encodeURIComponent(redirect)}`}
        className="tap-dim mt-7 inline-flex h-[3.125rem] items-center justify-center rounded-[var(--radius-md)] bg-accent px-7 text-[1.0625rem] font-semibold text-white"
      >
        Anmelden
      </Link>
    </div>
  );
}
