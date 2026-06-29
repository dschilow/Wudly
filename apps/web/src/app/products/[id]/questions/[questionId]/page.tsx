import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string; questionId: string }>;
}

export default async function LegacyProductQuestionPage({ params }: PageProps) {
  const { id, questionId } = await params;
  redirect(
    `/me/inbox?product=${encodeURIComponent(id)}&question=${encodeURIComponent(questionId)}`,
  );
}
