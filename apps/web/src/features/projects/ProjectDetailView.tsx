'use client';

import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { TaskListSection } from '@/features/tasks/TaskListSection';
import { isApiError } from '@/lib/api-client';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { DeleteProjectButton } from './DeleteProjectButton';
import { useProject } from './hooks';
import { ProjectStatusBadge } from './labels';

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const { data: project, error, isPending, refetch } = useProject(projectId);

  if (isPending) return <LoadingState label="Loading project..." />;
  if (error) {
    const notFound = isApiError(error) && (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR');
    return (
      <div className="space-y-4">
        <ErrorState
          error={error}
          title={notFound ? 'Project not found' : 'Could not load the project'}
          onRetry={notFound ? undefined : () => void refetch()}
        />
        <ButtonLink href="/projects" variant="secondary">
          Back to projects
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={project.name}
        description={<ProjectStatusBadge status={project.status} />}
        actions={
          <>
            <ButtonLink href={`/projects/${project.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </>
        }
      />
      <section aria-labelledby="project-details" className="mb-8 rounded-lg border border-slate-200 bg-white p-4">
        <h2 id="project-details" className="sr-only">
          Project details
        </h2>
        <p className="whitespace-pre-line break-words text-sm text-slate-700">{project.description || 'No description.'}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-500">Start date</dt>
            <dd className="text-slate-900">{formatDate(project.startDate) || 'Not set'}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">End date</dt>
            <dd className="text-slate-900">{formatDate(project.endDate) || 'Not set'}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Created</dt>
            <dd className="text-slate-900">{formatTimestamp(project.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Last updated</dt>
            <dd className="text-slate-900">{formatTimestamp(project.updatedAt)}</dd>
          </div>
        </dl>
      </section>
      <TaskListSection projectId={project.id} title="Tasks in this project" />
    </>
  );
}
