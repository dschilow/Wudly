import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyQuestionPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/me/inbox?question=${encodeURIComponent(id)}`);
}
