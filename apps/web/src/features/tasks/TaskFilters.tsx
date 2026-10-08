'use client';

import { LIMITS, type Project, type TaskPriority, type TaskStatus } from '@pm/shared';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Fields';
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from './labels';

export interface TaskFilterValues {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  projectId: string;
}

export const EMPTY_TASK_FILTERS: TaskFilterValues = { search: '', status: '', priority: '', projectId: '' };

interface TaskFiltersProps {
  values: TaskFilterValues;
  onChange: (values: TaskFilterValues) => void;
  /** When given, a project filter is shown (the all-tasks page). */
  projects?: Project[];
}

export function TaskFilters({ values, onChange, projects }: TaskFiltersProps) {
  const set = (changes: Partial<TaskFilterValues>) => onChange({ ...values, ...changes });
  const active = values.search !== '' || values.status !== '' || values.priority !== '' || values.projectId !== '';
  return (
    <section
      aria-label="Filter tasks"
      className={`mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 ${projects ? 'lg:grid-cols-[1fr_160px_160px_200px_auto]' : 'lg:grid-cols-[1fr_160px_160px_auto]'} lg:items-end`}
    >
      <TextField
        label="Search by name"
        type="search"
        value={values.search}
        maxLength={LIMITS.searchMax}
        onChange={(event) => set({ search: event.target.value })}
      />
      <SelectField label="Status" value={values.status} onChange={(event) => set({ status: event.target.value as TaskStatus | '' })}>
        <option value="">All statuses</option>
        {TASK_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Priority" value={values.priority} onChange={(event) => set({ priority: event.target.value as TaskPriority | '' })}>
        <option value="">All priorities</option>
        {TASK_PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {projects && (
        <SelectField label="Project" value={values.projectId} onChange={(event) => set({ projectId: event.target.value })}>
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </SelectField>
      )}
      <Button variant="ghost" onClick={() => onChange(EMPTY_TASK_FILTERS)} disabled={!active}>
        Reset filters
      </Button>
    </section>
  );
}
