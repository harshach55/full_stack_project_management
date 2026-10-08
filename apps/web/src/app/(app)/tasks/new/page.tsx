import type { Metadata } from 'next';
import { NewTaskView } from '@/features/tasks/TaskViews';

export const metadata: Metadata = { title: 'New task' };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  return <NewTaskView defaultProjectId={typeof projectId === 'string' ? projectId : undefined} />;
}
