import { z } from 'zod';

export const PROJECT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DEFAULT_PROJECT_STATUS: ProjectStatus = 'NOT_STARTED';
export const DEFAULT_TASK_STATUS: TaskStatus = 'PENDING';
export const DEFAULT_TASK_PRIORITY: TaskPriority = 'MEDIUM';

export const projectStatusSchema = z.enum(PROJECT_STATUSES, {
  error: (issue) => (issue.input === undefined ? 'Status is required.' : 'Invalid status.'),
});

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  error: (issue) => (issue.input === undefined ? 'Status is required.' : 'Invalid status.'),
});

export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
  error: (issue) => (issue.input === undefined ? 'Priority is required.' : 'Invalid priority.'),
});
