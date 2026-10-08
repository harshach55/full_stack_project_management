import type { DashboardResponse } from '@pm/shared';
import type { PrismaClient } from '@prisma/client';

/** All counts are computed per request from the caller's own data; nothing is stored. */
export async function getDashboard(prisma: PrismaClient, userId: string): Promise<DashboardResponse> {
  const [projectsByStatus, tasksByStatus] = await Promise.all([
    prisma.project.groupBy({ by: ['status'], where: { ownerId: userId }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['status'], where: { project: { ownerId: userId } }, _count: { _all: true } }),
  ]);

  const projectCount = (status: string) => projectsByStatus.find((row) => row.status === status)?._count._all ?? 0;
  const taskCount = (status: string) => tasksByStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    totalProjects: projectsByStatus.reduce((sum, row) => sum + row._count._all, 0),
    projectsInProgress: projectCount('IN_PROGRESS'),
    totalTasks: tasksByStatus.reduce((sum, row) => sum + row._count._all, 0),
    completedTasks: taskCount('COMPLETED'),
    // Exactly status PENDING (PD-01); IN_PROGRESS is counted separately.
    pendingTasks: taskCount('PENDING'),
    inProgressTasks: taskCount('IN_PROGRESS'),
  };
}
