import type { Metadata } from 'next';
import { api } from '@/lib/api';
import type { PublicInviteDto } from '@wudly/shared';
import { InviteRatingClient } from './InviteRatingClient';

export const metadata: Metadata = {
  title: 'Produkt bewerten',
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite: PublicInviteDto | null = null;
  try {
    invite = await api.invites.publicInvite(token, { cache: 'no-store' });
  } catch {
    invite = null;
  }
  return <InviteRatingClient token={token} invite={invite} />;
}
