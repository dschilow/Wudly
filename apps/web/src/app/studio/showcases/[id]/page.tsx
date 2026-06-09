import type { Metadata } from 'next';
import { ShowcaseEditorClient } from './ShowcaseEditorClient';

export const metadata: Metadata = {
  title: 'Showcase bearbeiten',
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioShowcaseEditorPage({ params }: PageProps) {
  const { id } = await params;
  return <ShowcaseEditorClient showcaseId={id} />;
}
