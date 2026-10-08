import type { IdParam, TaskCreateInput, TaskListQuery, TaskUpdateInput } from '@pm/shared';
import type { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';
import * as tasksService from './tasks.service.js';

export function createTasksController(prisma: PrismaClient) {
  const list: RequestHandler = async (req, res) => {
    res.json(await tasksService.listTasks(prisma, req.auth!.userId, req.valid.query as TaskListQuery));
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = req.valid.params as IdParam;
    res.json(await tasksService.getTask(prisma, req.auth!.userId, id));
  };

  const create: RequestHandler = async (req, res) => {
    const task = await tasksService.createTask(prisma, req.auth!.userId, req.valid.body as TaskCreateInput);
    res.status(201).json(task);
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = req.valid.params as IdParam;
    res.json(await tasksService.updateTask(prisma, req.auth!.userId, id, req.valid.body as TaskUpdateInput));
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = req.valid.params as IdParam;
    await tasksService.deleteTask(prisma, req.auth!.userId, id);
    res.status(204).end();
  };

  return { list, get, create, update, remove };
}
