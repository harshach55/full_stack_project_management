import type { ProjectListQuery, TaskListQuery } from '@pm/shared';

/** Same key layout as the web app: lists include their filters; prefixes are invalidated after changes. */
export const queryKeys = {
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
