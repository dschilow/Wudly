'use client';

import { useEffect, useState } from 'react';
import type { OwnershipCompanionDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * The signed-in visitor's companion for one product: null while loading, for
 * signed-out visitors and for products they don't own — so a call to action
 * never flashes "Check-in fällig" at someone who has nothing to check in.
 */
export function useViewerCompanion(productId: string): OwnershipCompanionDto | null {
  const { user } = useAuth();
  const [companion, setCompanion] = useState<OwnershipCompanionDto | null>(null);

  useEffect(() => {
    if (!user) {
      setCompanion(null);
      return;
    }
    let active = true;
    api.companion
      .forProduct(productId, { cache: 'no-store' })
      .then((res) => {
        if (active) setCompanion(res.companion);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, productId]);

  return companion;
}
