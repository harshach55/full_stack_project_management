import type { Metadata } from 'next';
import { TaskDetailView } from '@/features/tasks/TaskViews';

export const metadata: Metadata = { title: 'Task' };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetailView taskId={id} />;
}
