import type { Project, ProjectCreateInput, ProjectListQuery, ProjectUpdateInput } from '@pm/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { toDbDate } from '../../lib/dates.js';
import { projectNotFound } from '../../lib/errors.js';
import { isRecordNotFound } from '../../lib/prisma.js';
import { nameContains } from '../../lib/search.js';
import { toProjectResponse } from './project.mapper.js';

/*
 * Every query below includes ownerId = userId in its own where condition, so a project
 * owned by someone else behaves exactly like a missing one (404, PD-17).
 */

const newestFirst: Prisma.ProjectOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

export async function listProjects(prisma: PrismaClient, userId: string, query: ProjectListQuery): Promise<Project[]> {
  const projects = await prisma.project.findMany({
    where: {
      ownerId: userId,
      ...(query.status ? { status: query.status } : {}),
      ...nameContains(query.search),
    },
    orderBy: newestFirst,
  });
  return projects.map(toProjectResponse);
}

export async function getProject(prisma: PrismaClient, userId: string, projectId: string): Promise<Project> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!project) throw projectNotFound();
  return toProjectResponse(project);
}

export async function createProject(prisma: PrismaClient, userId: string, input: ProjectCreateInput): Promise<Project> {
  const project = await prisma.project.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description ?? null,
      ...(input.status ? { status: input.status } : {}),
      startDate: toDbDate(input.startDate),
      endDate: toDbDate(input.endDate),
    },
  });
  return toProjectResponse(project);
}

/** Full replacement of the editable fields; the ownership condition is part of the update itself. */
export async function updateProject(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
  input: ProjectUpdateInput,
): Promise<Project> {
  try {
    const project = await prisma.project.update({
      where: { id: projectId, ownerId: userId },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        startDate: toDbDate(input.startDate),
        endDate: toDbDate(input.endDate),
      },
    });
    return toProjectResponse(project);
  } catch (error) {
    if (isRecordNotFound(error)) throw projectNotFound();
    throw error;
  }
}

/** Tasks are removed by the database cascade (PD-09). */
export async function deleteProject(prisma: PrismaClient, userId: string, projectId: string): Promise<void> {
  try {
    await prisma.project.delete({ where: { id: projectId, ownerId: userId } });
  } catch (error) {
    if (isRecordNotFound(error)) throw projectNotFound();
    throw error;
  }
}
