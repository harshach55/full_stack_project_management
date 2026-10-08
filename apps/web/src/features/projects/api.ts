import type { Project, ProjectCreateInput, ProjectListQuery, ProjectUpdateInput } from '@pm/shared';
import { apiRequest } from '@/lib/api-client';

export const listProjects = (filters: ProjectListQuery, signal?: AbortSignal) =>
  apiRequest<Project[]>('/projects', { query: { search: filters.search, status: filters.status }, signal });

export const getProject = (id: string, signal?: AbortSignal) => apiRequest<Project>(`/projects/${id}`, { signal });

export const createProject = (input: ProjectCreateInput) =>
  apiRequest<Project>('/projects', { method: 'POST', body: input });

/** Full replacement: the body always contains all five editable fields (PD-07). */
export const updateProject = (id: string, input: ProjectUpdateInput) =>
  apiRequest<Project>(`/projects/${id}`, { method: 'PUT', body: input });

export const deleteProject = (id: string) => apiRequest<void>(`/projects/${id}`, { method: 'DELETE' });
