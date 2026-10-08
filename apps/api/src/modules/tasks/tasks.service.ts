import type { Task, TaskCreateInput, TaskListQuery, TaskUpdateInput } from '@pm/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { toDbDate } from '../../lib/dates.js';
import { projectNotFound, taskNotFound } from '../../lib/errors.js';
import { isForeignKeyViolation, isRecordNotFound } from '../../lib/prisma.js';
import { nameContains } from '../../lib/search.js';
import { toTaskResponse } from './task.mapper.js';

/*
 * Tasks have no owner column. Every query reaches the owner through the parent project
 * (task.project.ownerId = userId) in its own where condition (ADR-0013).
 */

const newestFirst: Prisma.TaskOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

async function assertProjectOwned(prisma: PrismaClient, userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId }, select: { id: true } });
  if (!project) throw projectNotFound();
}

export async function listTasks(prisma: PrismaClient, userId: string, query: TaskListQuery): Promise<Task[]> {
  // With projectId, a missing project and another user's project both return 404 (PD-11).
  if (query.projectId) await assertProjectOwned(prisma, userId, query.projectId);

  const tasks = await prisma.task.findMany({
    where: {
      project: { ownerId: userId },
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...nameContains(query.search),
    },
    orderBy: newestFirst,
  });
  return tasks.map(toTaskResponse);
}

export async function getTask(prisma: PrismaClient, userId: string, taskId: string): Promise<Task> {
  const task = await prisma.task.findFirst({ where: { id: taskId, project: { ownerId: userId } } });
  if (!task) throw taskNotFound();
  return toTaskResponse(task);
}

export async function createTask(prisma: PrismaClient, userId: string, input: TaskCreateInput): Promise<Task> {
  await assertProjectOwned(prisma, userId, input.projectId);
  try {
    const task = await prisma.task.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description ?? null,
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.status ? { status: input.status } : {}),
        dueDate: toDbDate(input.dueDate),
      },
    });
    return toTaskResponse(task);
  } catch (error) {
    // The project was deleted between the ownership check and the insert.
    if (isForeignKeyViolation(error)) throw projectNotFound();
    throw error;
  }
}

/**
 * Full replacement of the five editable fields. projectId is never written: it is not
 * part of the update input, so a task cannot move to another project (PD-08).
 */
export async function updateTask(prisma: PrismaClient, userId: string, taskId: string, input: TaskUpdateInput): Promise<Task> {
  try {
    const task = await prisma.task.update({
      where: { id: taskId, project: { ownerId: userId } },
      data: {
        name: input.name,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueDate: toDbDate(input.dueDate),
      },
    });
    return toTaskResponse(task);
  } catch (error) {
    if (isRecordNotFound(error)) throw taskNotFound();
    throw error;
  }
}

export async function deleteTask(prisma: PrismaClient, userId: string, taskId: string): Promise<void> {
  try {
    await prisma.task.delete({ where: { id: taskId, project: { ownerId: userId } } });
  } catch (error) {
    if (isRecordNotFound(error)) throw taskNotFound();
    throw error;
  }
}
