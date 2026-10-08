import type { Task, TaskUpdateInput } from '@pm/shared';

/**
 * Builds the complete editable representation for PUT /api/tasks/{id} (PD-07): all five
 * editable fields from the current task, with the given changes applied. projectId, id and
 * timestamps are never included (projectId cannot change, PD-08).
 */
export function toTaskUpdateBody(task: Task, changes: Partial<TaskUpdateInput> = {}): TaskUpdateInput {
  return {
    name: changes.name ?? task.name,
    description: changes.description !== undefined ? changes.description : task.description,
    priority: changes.priority ?? task.priority,
    status: changes.status ?? task.status,
    dueDate: changes.dueDate !== undefined ? changes.dueDate : task.dueDate,
  };
}
