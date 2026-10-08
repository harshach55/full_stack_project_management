'use client';

import type { Task, TaskCreateInput, TaskListQuery, TaskUpdateInput } from '@pm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import * as tasksApi from './api';

export function useTasks(filters: TaskListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: ({ signal }) => tasksApi.listTasks(filters, signal),
    placeholderData: (previous) => previous,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: ({ signal }) => tasksApi.getTask(id, signal),
  });
}

/** After any task change, task lists and the dashboard counts are refetched. */
function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: TaskCreateInput) => tasksApi.createTask(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskUpdateInput }) => tasksApi.updateTask(id, body),
    onSuccess: async (task: Task) => {
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
      await invalidate();
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(id) });
      await invalidate();
    },
  });
}
