import type { Metadata } from 'next';
import { EditProjectView } from '@/features/projects/ProjectEditorViews';

export const metadata: Metadata = { title: 'Edit project' };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditProjectView projectId={id} />;
}
