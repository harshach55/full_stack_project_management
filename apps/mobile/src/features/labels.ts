import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES, type ProjectStatus, type TaskPriority, type TaskStatus } from '@pm/shared';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

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

export const PROJECT_STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({ value, label: PROJECT_STATUS_LABELS[value] }));
export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }));
export const TASK_PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }));

/** Badge colors (background, text) per value. */
export const STATUS_COLORS: Record<ProjectStatus | TaskStatus, [string, string]> = {
  NOT_STARTED: ['#f1f5f9', '#334155'],
  PENDING: ['#fef3c7', '#78350f'],
  IN_PROGRESS: ['#dbeafe', '#1e40af'],
  COMPLETED: ['#dcfce7', '#166534'],
};

export const PRIORITY_COLORS: Record<TaskPriority, [string, string]> = {
  LOW: ['#f1f5f9', '#334155'],
  MEDIUM: ['#ede9fe', '#5b21b6'],
  HIGH: ['#fee2e2', '#991b1b'],
};
