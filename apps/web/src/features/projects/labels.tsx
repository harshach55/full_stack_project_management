import { PROJECT_STATUSES, type ProjectStatus } from '@pm/shared';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

const STATUS_STYLES: Record<ProjectStatus, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export const PROJECT_STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({ value, label: PROJECT_STATUS_LABELS[value] }));

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
