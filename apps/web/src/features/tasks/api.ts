import type { Task, TaskCreateInput, TaskListQuery, TaskUpdateInput } from '@pm/shared';
import { apiRequest } from '@/lib/api-client';

export const listTasks = (filters: TaskListQuery, signal?: AbortSignal) =>
  apiRequest<Task[]>('/tasks', {
    query: { projectId: filters.projectId, search: filters.search, status: filters.status, priority: filters.priority },
    signal,
  });

export const getTask = (id: string, signal?: AbortSignal) => apiRequest<Task>(`/tasks/${id}`, { signal });

export const createTask = (input: TaskCreateInput) => apiRequest<Task>('/tasks', { method: 'POST', body: input });

/** Full replacement: exactly the five editable fields; never projectId (PD-07, PD-08). */
export const updateTask = (id: string, input: TaskUpdateInput) =>
  apiRequest<Task>(`/tasks/${id}`, {
    method: 'PUT',
    body: {
      name: input.name,
      description: input.description,
      priority: input.priority,
      status: input.status,
      dueDate: input.dueDate,
    },
  });

export const deleteTask = (id: string) => apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' });
