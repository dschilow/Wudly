import { redirect } from 'next/navigation';

/**
 * `/register` is an alias people type or that external links point to. The auth
 * UI lives on `/login` with a mode toggle, so forward there in register mode
 * (preserving any `redirect` target) instead of 404ing.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const target = typeof params.redirect === 'string' ? params.redirect : undefined;
  const query = new URLSearchParams({ mode: 'register' });
  if (target) query.set('redirect', target);
  redirect(`/login?${query.toString()}`);
}
