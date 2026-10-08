import type { ProjectCreateInput, ProjectListQuery, ProjectUpdateInput, Task, TaskCreateInput, TaskListQuery, TaskUpdateInput } from '@pm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import * as endpoints from './api';

export function useDashboard() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: ({ signal }) => endpoints.getDashboard(api, signal) });
}

export function useProjects(filters: ProjectListQuery = {}) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: ({ signal }) => endpoints.listProjects(api, filters, signal),
    placeholderData: (previous) => previous,
  });
}

export function useProject(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: ({ signal }) => endpoints.getProject(api, id, signal),
    enabled: id !== '',
  });
}

export function useTasks(filters: TaskListQuery = {}) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: ({ signal }) => endpoints.listTasks(api, filters, signal),
    placeholderData: (previous) => previous,
  });
}

export function useTask(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: ({ signal }) => endpoints.getTask(api, id, signal),
    enabled: id !== '',
  });
}

/** After a change, the affected lists and the dashboard counts are refetched. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: (readonly string[])[]) =>
    Promise.all([...keys, queryKeys.dashboard].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useCreateProject() {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ProjectCreateInput) => endpoints.createProject(api, input),
    onSuccess: () => invalidate(queryKeys.projects.all),
  });
}

export function useUpdateProject(id: string) {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ProjectUpdateInput) => endpoints.updateProject(api, id, input),
    onSuccess: () => invalidate(queryKeys.projects.all),
  });
}

export function useDeleteProject() {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => endpoints.deleteProject(api, id),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      // The project's tasks were deleted with it (PD-09).
      await invalidate(queryKeys.projects.all, queryKeys.tasks.all);
    },
  });
}

export function useCreateTask() {
  const api = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: TaskCreateInput) => endpoints.createTask(api, input),
    onSuccess: () => invalidate(queryKeys.tasks.all),
  });
}

export function useUpdateTask() {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskUpdateInput }) => endpoints.updateTask(api, id, body),
    onSuccess: async (task: Task) => {
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
      await invalidate(queryKeys.tasks.all);
    },
  });
}

export function useDeleteTask() {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => endpoints.deleteTask(api, id),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(id) });
      await invalidate(queryKeys.tasks.all);
    },
  });
}
