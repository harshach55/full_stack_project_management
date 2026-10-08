import type { ProjectListQuery, TaskListQuery } from '@pm/shared';

/**
 * Query keys for TanStack Query. Lists include their filters, so each filter combination is
 * cached separately; invalidating a prefix (for example ['tasks']) refreshes all of them.
 */
export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  projects: {
    all: ['projects'] as const,
    list: (filters: ProjectListQuery) => ['projects', 'list', filters] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (filters: TaskListQuery) => ['tasks', 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },
};
