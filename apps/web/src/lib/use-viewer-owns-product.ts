'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * Whether the signed-in visitor already registered this product as theirs.
 * Defaults to `false` while loading and for signed-out visitors, so a call to
 * action never flashes "Erfahrung aktualisieren" at someone who has nothing
 * to update.
 */
export function useViewerOwnsProduct(productId: string): boolean {
  const { user } = useAuth();
  const [owns, setOwns] = useState(false);

  useEffect(() => {
    if (!user) {
      setOwns(false);
      return;
    }
    let active = true;
    api.ownership
      .mine({ cache: 'no-store' })
      .then((list) => {
        if (active) setOwns(list.some((o) => o.productId === productId));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, productId]);

  return owns;
}
