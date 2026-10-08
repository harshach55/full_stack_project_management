import { z } from 'zod';

const count = z.number().int().nonnegative();

export const dashboardResponseSchema = z.object({
  totalProjects: count,
  projectsInProgress: count,
  totalTasks: count,
  completedTasks: count,
  pendingTasks: count,
  inProgressTasks: count,
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  database: z.enum(['ok', 'unavailable']),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
