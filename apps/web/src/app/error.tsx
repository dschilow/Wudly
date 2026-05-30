'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-6xl" aria-hidden>
        ⚠️
      </div>
      <h1 className="mt-4 text-2xl font-black text-ink">Etwas ist schiefgelaufen</h1>
      <p className="mt-2 text-muted-foreground">
        Bitte versuche es erneut. Wenn das Problem bleibt, lade die Seite neu.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Erneut versuchen</Button>
      </div>
    </div>
  );
}
