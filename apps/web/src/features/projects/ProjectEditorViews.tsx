'use client';

import { useRouter } from 'next/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { useCreateProject, useProject, useUpdateProject } from './hooks';
import { ProjectForm } from './ProjectForm';

export function NewProjectView() {
  const router = useRouter();
  const createProject = useCreateProject();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New project" />
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <ProjectForm
          submitLabel="Create project"
          submitting={createProject.isPending}
          onCancel={() => router.push('/projects')}
          onSubmit={async (values) => {
            const project = await createProject.mutateAsync(values);
            router.push(`/projects/${project.id}`);
          }}
        />
      </div>
    </div>
  );
}

export function EditProjectView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data: project, error, isPending, refetch } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);

  if (isPending) return <LoadingState label="Loading project..." />;
  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the project" />
        <ButtonLink href="/projects" variant="secondary">
          Back to projects
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit project" />
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <ProjectForm
          initial={project}
          submitLabel="Save changes"
          submitting={updateProject.isPending}
          onCancel={() => router.push(`/projects/${project.id}`)}
          onSubmit={async (values) => {
            await updateProject.mutateAsync(values);
            router.push(`/projects/${project.id}`);
          }}
        />
      </div>
    </div>
  );
}
