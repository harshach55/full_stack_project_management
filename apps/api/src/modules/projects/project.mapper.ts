import type { Project } from '@pm/shared';
import type { Project as ProjectRecord } from '@prisma/client';
import { fromDbDate, toTimestamp } from '../../lib/dates.js';

/** ownerId is not part of the representation: every project returned belongs to the caller. */
export function toProjectResponse(project: ProjectRecord): Project {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: fromDbDate(project.startDate),
    endDate: fromDbDate(project.endDate),
    createdAt: toTimestamp(project.createdAt),
    updatedAt: toTimestamp(project.updatedAt),
  };
}
