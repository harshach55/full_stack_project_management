import { z } from 'zod';
import { taskPrioritySchema, taskStatusSchema } from './enums.js';
import { dateStringSchema, descriptionSchema, idSchema, nameSchema, searchSchema } from './validators.js';

/** POST /api/tasks: projectId and name are required. */
export const taskCreateBodySchema = z.strictObject({
  projectId: idSchema,
  name: nameSchema,
  description: descriptionSchema.optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueDate: dateStringSchema.nullable().optional(),
});

/**
 * PUT /api/tasks/{id}: full replacement of the five editable fields.
 * projectId is not part of the editable representation and is rejected (PD-08).
 */
export const taskUpdateBodySchema = z.strictObject({
  name: nameSchema,
  description: descriptionSchema,
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: dateStringSchema.nullable(),
});

/** Keys of the editable task representation, used by clients to build a full PUT body. */
export const TASK_EDITABLE_FIELDS = ['name', 'description', 'priority', 'status', 'dueDate'] as const;

export const taskListQuerySchema = z.strictObject({
  projectId: idSchema.optional(),
  search: searchSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
});

export const taskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaskCreateInput = z.infer<typeof taskCreateBodySchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateBodySchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
export type Task = z.infer<typeof taskSchema>;
