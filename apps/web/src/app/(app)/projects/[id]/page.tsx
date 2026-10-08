import type { Metadata } from 'next';
import { ProjectDetailView } from '@/features/projects/ProjectDetailView';

export const metadata: Metadata = { title: 'Project' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailView projectId={id} />;
}
