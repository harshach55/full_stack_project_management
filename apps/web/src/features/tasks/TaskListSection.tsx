'use client';

import { useMemo, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { LoadingState, Spinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useProjects } from '@/features/projects/hooks';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTasks } from './hooks';
import { EMPTY_TASK_FILTERS, TaskFilters, type TaskFilterValues } from './TaskFilters';
import { TaskList } from './TaskList';

interface TaskListSectionProps {
  /** Fixed project (project detail page). Without it, all of the user's tasks are listed with a project filter. */
  projectId?: string;
  title: string;
}

/** Task list with server-side search and filters (name, status, priority, project), newest first. */
export function TaskListSection({ projectId, title }: TaskListSectionProps) {
  const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_TASK_FILTERS);
  // Typing is debounced; clearing the search applies immediately.
  const debouncedSearch = useDebouncedValue(filters.search.trim());
  const effectiveSearch = filters.search.trim() === '' ? '' : debouncedSearch;
  const query = {
    projectId: projectId ?? (filters.projectId || undefined),
    search: effectiveSearch || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
  };
  const filtered = Boolean(query.search || query.status || query.priority || (!projectId && query.projectId));

  const tasks = useTasks(query);
  // Project names for the all-tasks view (filter options and labels).
  const projects = useProjects({});
  const projectNames = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);

  const newTaskHref = `/tasks/new${query.projectId ? `?projectId=${query.projectId}` : ''}`;

  return (
    <section aria-labelledby="task-list-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="task-list-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <ButtonLink href={newTaskHref}>New task</ButtonLink>
      </div>

      <TaskFilters values={filters} onChange={setFilters} projects={projectId ? undefined : (projects.data ?? [])} />

      <div className="mb-2 h-5 text-sm text-slate-500" aria-live="polite">
        {tasks.isFetching && !tasks.isPending && <Spinner size="sm" label="Updating..." />}
      </div>

      {tasks.isPending ? (
        <LoadingState label="Loading tasks..." />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} title="Could not load tasks" />
      ) : tasks.data.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No tasks match your filters"
            description="Try a different search, status, priority or project."
            action={
              <Button variant="secondary" onClick={() => setFilters(EMPTY_TASK_FILTERS)}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No tasks yet"
            description={projectId ? 'Add the first task to this project.' : 'Create a task in one of your projects.'}
            action={<ButtonLink href={newTaskHref}>Create task</ButtonLink>}
          />
        )
      ) : (
        <TaskList tasks={tasks.data} projectNames={projectId ? undefined : projectNames} />
      )}
    </section>
  );
}
