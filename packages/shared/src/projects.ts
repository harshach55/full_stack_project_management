import { z } from 'zod';
import { projectStatusSchema } from './enums.js';
import { dateStringSchema, descriptionSchema, idSchema, nameSchema, searchSchema } from './validators.js';

const END_BEFORE_START = 'End date must be on or after the start date.';

function endDateNotBeforeStart(value: { startDate?: string | null; endDate?: string | null }): boolean {
  if (!value.startDate || !value.endDate) return true;
  // YYYY-MM-DD strings compare correctly as text.
  return value.endDate >= value.startDate;
}

/** POST /api/projects: only name is required. */
export const projectCreateBodySchema = z
  .strictObject({
    name: nameSchema,
    description: descriptionSchema.optional(),
    status: projectStatusSchema.optional(),
    startDate: dateStringSchema.nullable().optional(),
    endDate: dateStringSchema.nullable().optional(),
  })
  .refine(endDateNotBeforeStart, { path: ['endDate'], error: END_BEFORE_START });

/** PUT /api/projects/{id}: full replacement, every editable field is a required key. */
export const projectUpdateBodySchema = z
  .strictObject({
    name: nameSchema,
    description: descriptionSchema,
    status: projectStatusSchema,
    startDate: dateStringSchema.nullable(),
    endDate: dateStringSchema.nullable(),
  })
  .refine(endDateNotBeforeStart, { path: ['endDate'], error: END_BEFORE_START });

export const projectListQuerySchema = z.strictObject({
  search: searchSchema.optional(),
  status: projectStatusSchema.optional(),
});

export const idParamSchema = z.strictObject({
  id: idSchema,
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectCreateInput = z.infer<typeof projectCreateBodySchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateBodySchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type Project = z.infer<typeof projectSchema>;
