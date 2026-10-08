import type { IdParam, ProjectCreateInput, ProjectListQuery, ProjectUpdateInput } from '@pm/shared';
import type { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';
import * as projectsService from './projects.service.js';

export function createProjectsController(prisma: PrismaClient) {
  const list: RequestHandler = async (req, res) => {
    res.json(await projectsService.listProjects(prisma, req.auth!.userId, req.valid.query as ProjectListQuery));
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = req.valid.params as IdParam;
    res.json(await projectsService.getProject(prisma, req.auth!.userId, id));
  };

  const create: RequestHandler = async (req, res) => {
    const project = await projectsService.createProject(prisma, req.auth!.userId, req.valid.body as ProjectCreateInput);
    res.status(201).json(project);
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = req.valid.params as IdParam;
    res.json(await projectsService.updateProject(prisma, req.auth!.userId, id, req.valid.body as ProjectUpdateInput));
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = req.valid.params as IdParam;
    await projectsService.deleteProject(prisma, req.auth!.userId, id);
    res.status(204).end();
  };

  return { list, get, create, update, remove };
}
