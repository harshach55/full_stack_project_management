'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { useProject, useProjects } from '@/features/projects/hooks';
import { isApiError } from '@/lib/api-client';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { errorMessage } from '@/lib/error-messages';
import { useCreateTask, useDeleteTask, useTask, useUpdateTask } from './hooks';
import { TaskPriorityBadge, TaskStatusBadge } from './labels';
import { TaskForm } from './TaskForm';
import { TaskListSection } from './TaskListSection';
import { TaskQuickActions } from './TaskQuickActions';

export function TasksView() {
  return (
    <>
      <PageHeader title="Tasks" description="All tasks across your projects." />
      <TaskListSection title="Your tasks" />
    </>
  );
}

function TaskLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notFound = isApiError(error) && (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR');
  return (
    <div className="space-y-4">
      <ErrorState error={error} title={notFound ? 'Task not found' : 'Could not load the task'} onRetry={notFound ? undefined : onRetry} />
      <ButtonLink href="/tasks" variant="secondary">
        Back to tasks
      </ButtonLink>
    </div>
  );
}

export function TaskDetailView({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { data: task, error, isPending, refetch } = useTask(taskId);
  const project = useProject(task?.projectId ?? '');
  const deleteTask = useDeleteTask();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isPending) return <LoadingState label="Loading task..." />;
  if (error) return <TaskLoadError error={error} onRetry={() => void refetch()} />;

  const confirmDelete = () =>
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        router.replace(`/projects/${task.projectId}`);
      },
    });

  return (
    <>
      <PageHeader
        title={task.name}
        description={
          <span className="flex flex-wrap gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/tasks/${task.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          </>
        }
      />
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="whitespace-pre-line break-words text-sm text-slate-700">{task.description || 'No description.'}</p>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-500">Project</dt>
            <dd className="break-words">
              <Link href={`/projects/${task.projectId}`} className="text-blue-700 hover:underline">
                {project.data?.name ?? 'View project'}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Due date</dt>
            <dd className="text-slate-900">{formatDate(task.dueDate) || 'Not set'}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Created</dt>
            <dd className="text-slate-900">{formatTimestamp(task.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Last updated</dt>
            <dd className="text-slate-900">{formatTimestamp(task.updatedAt)}</dd>
          </div>
        </dl>
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-800">Quick actions</h2>
          <TaskQuickActions task={task} />
        </div>
      </section>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete task?"
        confirmLabel="Delete task"
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          deleteTask.reset();
        }}
        loading={deleteTask.isPending}
      >
        <p>
          <strong className="break-words">{task.name}</strong> will be permanently deleted.
        </p>
        {deleteTask.isError && (
          <div className="mt-3">
            <Alert>{errorMessage(deleteTask.error)}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

export function NewTaskView({ defaultProjectId }: { defaultProjectId?: string }) {
  const router = useRouter();
  const projects = useProjects({});
  const createTask = useCreateTask();

  let content;
  if (projects.isPending) content = <LoadingState label="Loading projects..." />;
  else if (projects.error) content = <ErrorState error={projects.error} onRetry={() => void projects.refetch()} title="Could not load your projects" />;
  else if (projects.data.length === 0)
    content = (
      <EmptyState
        title="Create a project first"
        description="Every task belongs to a project."
        action={<ButtonLink href="/projects/new">Create project</ButtonLink>}
      />
    );
  else
    content = (
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <TaskForm
          mode="create"
          projects={projects.data}
          defaultProjectId={projects.data.some((p) => p.id === defaultProjectId) ? defaultProjectId : undefined}
          submitting={createTask.isPending}
          onCancel={() => router.back()}
          onSubmit={async (values) => {
            const task = await createTask.mutateAsync(values);
            router.push(`/tasks/${task.id}`);
          }}
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New task" />
      {content}
    </div>
  );
}

export function EditTaskView({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { data: task, error, isPending, refetch } = useTask(taskId);
  const project = useProject(task?.projectId ?? '');
  const updateTask = useUpdateTask();

  if (isPending) return <LoadingState label="Loading task..." />;
  if (error) return <TaskLoadError error={error} onRetry={() => void refetch()} />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit task" />
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <TaskForm
          mode="edit"
          task={task}
          projectName={project.data?.name ?? 'Loading...'}
          submitting={updateTask.isPending}
          onCancel={() => router.push(`/tasks/${task.id}`)}
          onSubmit={async (values) => {
            await updateTask.mutateAsync({ id: task.id, body: values });
            router.push(`/tasks/${task.id}`);
          }}
        />
      </div>
    </div>
  );
}
