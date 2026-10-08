import type {
  DashboardResponse,
  Project,
  ProjectCreateInput,
  ProjectListQuery,
  ProjectUpdateInput,
  Task,
  TaskCreateInput,
  TaskListQuery,
  TaskUpdateInput,
} from '@pm/shared';
import type { ApiClient } from '@/lib/api-client';

/*
 * Endpoint functions for the existing REST API (docs/api-contract.md). They take the client
 * as a parameter so they can be tested without a device; screens use them through hooks.
 */

export const getDashboard = (api: ApiClient, signal?: AbortSignal) => api.request<DashboardResponse>('/dashboard', { signal });

export const listProjects = (api: ApiClient, filters: ProjectListQuery, signal?: AbortSignal) =>
  api.request<Project[]>('/projects', { query: { search: filters.search, status: filters.status }, signal });

export const getProject = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.request<Project>(`/projects/${encodeURIComponent(id)}`, { signal });

export const createProject = (api: ApiClient, input: ProjectCreateInput) =>
  api.request<Project>('/projects', { method: 'POST', body: input });

/** Full replacement: all five editable project fields (PD-07). */
export const updateProject = (api: ApiClient, id: string, input: ProjectUpdateInput) =>
  api.request<Project>(`/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: input });

export const deleteProject = (api: ApiClient, id: string) =>
  api.request<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listTasks = (api: ApiClient, filters: TaskListQuery, signal?: AbortSignal) =>
  api.request<Task[]>('/tasks', {
    query: { projectId: filters.projectId, search: filters.search, status: filters.status, priority: filters.priority },
    signal,
  });

export const getTask = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.request<Task>(`/tasks/${encodeURIComponent(id)}`, { signal });

export const createTask = (api: ApiClient, input: TaskCreateInput) => api.request<Task>('/tasks', { method: 'POST', body: input });

/** Full replacement: exactly the five editable fields; never projectId (PD-07, PD-08). */
export const updateTask = (api: ApiClient, id: string, input: TaskUpdateInput) =>
  api.request<Task>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { name: input.name, description: input.description, priority: input.priority, status: input.status, dueDate: input.dueDate },
  });

export const deleteTask = (api: ApiClient, id: string) => api.request<void>(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
