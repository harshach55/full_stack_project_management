import { describe, expect, it } from 'vitest';
import {
  idParamSchema,
  isValidDateString,
  loginBodySchema,
  projectCreateBodySchema,
  projectListQuerySchema,
  projectUpdateBodySchema,
  registerBodySchema,
  taskCreateBodySchema,
  taskListQuerySchema,
  taskUpdateBodySchema,
  utf8ByteLength,
} from '../src/index.js';

const VALID_ID = '3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f8a9b0c';

describe('date strings', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDateString('2026-10-08')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
  });

  it('rejects impossible dates and other formats', () => {
    for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '0000-01-01', '2026-1-01', '20261008', '2026-10-08T00:00:00Z', '']) {
      expect(isValidDateString(value)).toBe(false);
    }
  });
});

describe('registerBodySchema', () => {
  const valid = { fullName: '  Alice Example ', email: '  Alice@Example.COM ', password: 'correct-horse' };

  it('trims the name and normalizes the email', () => {
    const parsed = registerBodySchema.parse(valid);
    expect(parsed.fullName).toBe('Alice Example');
    expect(parsed.email).toBe('alice@example.com');
    expect(parsed.password).toBe('correct-horse');
  });

  it('measures password length in UTF-8 bytes', () => {
    // 4 characters, 12 bytes: long enough in bytes.
    expect(registerBodySchema.safeParse({ ...valid, password: '\u20ac\u20ac\u20ac\u20ac' }).success).toBe(true);
    expect(utf8ByteLength('\u20ac')).toBe(3);
    // 25 three-byte characters = 75 bytes: over the bcrypt limit.
    expect(registerBodySchema.safeParse({ ...valid, password: '\u20ac'.repeat(25) }).success).toBe(false);
    expect(registerBodySchema.safeParse({ ...valid, password: 'a'.repeat(72) }).success).toBe(true);
    expect(registerBodySchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success).toBe(false);
    expect(registerBodySchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('rejects blank names, invalid emails and unknown fields', () => {
    expect(registerBodySchema.safeParse({ ...valid, fullName: '   ' }).success).toBe(false);
    expect(registerBodySchema.safeParse({ ...valid, fullName: 'a'.repeat(101) }).success).toBe(false);
    expect(registerBodySchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    expect(registerBodySchema.safeParse({ ...valid, passwordHash: 'x' }).success).toBe(false);
  });
});

describe('loginBodySchema', () => {
  it('requires a non-empty password within 72 bytes', () => {
    expect(loginBodySchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true);
    expect(loginBodySchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false);
    expect(loginBodySchema.safeParse({ email: 'a@example.com', password: 'a'.repeat(73) }).success).toBe(false);
  });
});

describe('project schemas', () => {
  it('accepts a minimal create body', () => {
    expect(projectCreateBodySchema.parse({ name: ' Website ' })).toEqual({ name: 'Website' });
  });

  it('turns an empty description into null', () => {
    expect(projectCreateBodySchema.parse({ name: 'A', description: '   ' }).description).toBeNull();
  });

  it('rejects endDate before startDate', () => {
    const result = projectCreateBodySchema.safeParse({ name: 'A', startDate: '2026-10-10', endDate: '2026-10-09' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('requires every editable key on update', () => {
    const result = projectUpdateBodySchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.')).sort();
    expect(paths).toEqual(['description', 'endDate', 'startDate', 'status']);
  });

  it('accepts a full update with nulls', () => {
    const body = { name: 'A', description: null, status: 'COMPLETED', startDate: null, endDate: null };
    expect(projectUpdateBodySchema.parse(body)).toEqual(body);
  });

  it('rejects server-owned fields', () => {
    expect(projectCreateBodySchema.safeParse({ name: 'A', ownerId: VALID_ID }).success).toBe(false);
    expect(projectCreateBodySchema.safeParse({ name: 'A', id: VALID_ID }).success).toBe(false);
    expect(projectCreateBodySchema.safeParse({ name: 'A', createdAt: '2026-10-08' }).success).toBe(false);
  });

  it('validates list queries', () => {
    expect(projectListQuerySchema.parse({ search: '  ' })).toEqual({ search: undefined });
    expect(projectListQuerySchema.safeParse({ status: 'DONE' }).success).toBe(false);
    expect(projectListQuerySchema.safeParse({ status: ['IN_PROGRESS', 'COMPLETED'] }).success).toBe(false);
    expect(projectListQuerySchema.safeParse({ sort: 'name' }).success).toBe(false);
  });
});

describe('task schemas', () => {
  it('requires projectId and name on create', () => {
    expect(taskCreateBodySchema.safeParse({ name: 'T' }).success).toBe(false);
    expect(taskCreateBodySchema.parse({ projectId: VALID_ID.toUpperCase(), name: 'T' }).projectId).toBe(VALID_ID);
  });

  it('requires all five editable fields on update and rejects projectId', () => {
    const full = { name: 'T', description: null, priority: 'HIGH', status: 'COMPLETED', dueDate: null };
    expect(taskUpdateBodySchema.parse(full)).toEqual(full);
    expect(taskUpdateBodySchema.safeParse({ status: 'COMPLETED' }).success).toBe(false);
    expect(taskUpdateBodySchema.safeParse({ ...full, projectId: VALID_ID }).success).toBe(false);
  });

  it('rejects invalid enums and dates', () => {
    expect(taskCreateBodySchema.safeParse({ projectId: VALID_ID, name: 'T', priority: 'URGENT' }).success).toBe(false);
    expect(taskCreateBodySchema.safeParse({ projectId: VALID_ID, name: 'T', dueDate: '2026-02-30' }).success).toBe(false);
  });

  it('validates list queries', () => {
    expect(taskListQuerySchema.safeParse({ projectId: 'abc' }).success).toBe(false);
    expect(taskListQuerySchema.parse({ priority: 'LOW', status: 'PENDING' })).toEqual({ priority: 'LOW', status: 'PENDING' });
  });
});

describe('idParamSchema', () => {
  it('rejects non-UUID ids', () => {
    expect(idParamSchema.safeParse({ id: '123' }).success).toBe(false);
    expect(idParamSchema.parse({ id: VALID_ID }).id).toBe(VALID_ID);
  });
});
