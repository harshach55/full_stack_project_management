import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '@pm/shared';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }));
export const TASK_PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }));

const STATUS_STYLES: Record<TaskStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-violet-100 text-violet-800',
  HIGH: 'bg-red-100 text-red-800',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{TASK_STATUS_LABELS[status]}</span>;
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
      {TASK_PRIORITY_LABELS[priority]} priority
    </span>
  );
}
