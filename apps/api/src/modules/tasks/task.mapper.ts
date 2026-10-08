import type { Task } from '@pm/shared';
import type { Task as TaskRecord } from '@prisma/client';
import { fromDbDate, toTimestamp } from '../../lib/dates.js';

export function toTaskResponse(task: TaskRecord): Task {
  return {
    id: task.id,
    projectId: task.projectId,
    name: task.name,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: fromDbDate(task.dueDate),
    createdAt: toTimestamp(task.createdAt),
    updatedAt: toTimestamp(task.updatedAt),
  };
}
