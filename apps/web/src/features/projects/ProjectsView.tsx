'use client';

import { LIMITS, type ProjectStatus } from '@pm/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Fields';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState, Spinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useProjects } from './hooks';
import { PROJECT_STATUS_OPTIONS, ProjectStatusBadge } from './labels';

/** Project list with server-side search (by name) and status filter, newest first. */
export function ProjectsView() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  // Typing is debounced; clearing the search applies immediately.
  const debouncedSearch = useDebouncedValue(search.trim());
  const effectiveSearch = search.trim() === '' ? '' : debouncedSearch;
  const filters = { search: effectiveSearch || undefined, status: status || undefined };
  const filtered = Boolean(filters.search || filters.status);
  const { data, error, isPending, isFetching, refetch } = useProjects(filters);

  const resetFilters = () => {
    setSearch('');
    setStatus('');
  };

  return (
    <>
      <PageHeader title="Projects" actions={<ButtonLink href="/projects/new">New project</ButtonLink>} />

      <section aria-label="Filter projects" className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <TextField
          label="Search by name"
          type="search"
          value={search}
          maxLength={LIMITS.searchMax}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | '')}>
          <option value="">All statuses</option>
          {PROJECT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <Button variant="ghost" onClick={resetFilters} disabled={!search && !status}>
          Reset filters
        </Button>
      </section>

      <div className="mb-2 h-5 text-sm text-slate-500" aria-live="polite">
        {isFetching && !isPending && <Spinner size="sm" label="Updating..." />}
      </div>

      {isPending ? (
        <LoadingState label="Loading projects..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load projects" />
      ) : data.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No projects match your filters"
            description="Try a different search or status."
            action={
              <Button variant="secondary" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first project to start adding tasks."
            action={<ButtonLink href="/projects/new">Create project</ButtonLink>}
          />
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words font-semibold text-slate-900">{project.name}</h2>
                  <ProjectStatusBadge status={project.status} />
                </div>
                {project.description && <p className="mt-2 line-clamp-2 break-words text-sm text-slate-600">{project.description}</p>}
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
                  <div>
                    <dt className="font-medium">Start</dt>
                    <dd>{formatDate(project.startDate) || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">End</dt>
                    <dd>{formatDate(project.endDate) || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">Created</dt>
                    <dd>{formatTimestamp(project.createdAt)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
