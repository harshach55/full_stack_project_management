'use client';

import type { ProjectCreateInput, ProjectListQuery, ProjectUpdateInput } from '@pm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import * as projectsApi from './api';

export function useProjects(filters: ProjectListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: ({ signal }) => projectsApi.listProjects(filters, signal),
    // Keep showing the previous results while a new search or filter loads.
    placeholderData: (previous) => previous,
  });
}

/** A single project; does nothing until an id is known. */
export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: ({ signal }) => projectsApi.getProject(id, signal),
    enabled: id !== '',
  });
}

/** After any project change, project lists and the dashboard counts are refetched. */
function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return async (alsoTasks = false) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ...(alsoTasks ? [queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })] : []),
    ]);
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: ProjectCreateInput) => projectsApi.createProject(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: ProjectUpdateInput) => projectsApi.updateProject(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      // The project's tasks were deleted with it (PD-09).
      await invalidate(true);
    },
  });
}
