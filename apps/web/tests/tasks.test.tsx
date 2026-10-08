import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { toTaskUpdateBody } from '@/features/tasks/task-body';
import { TaskListSection } from '@/features/tasks/TaskListSection';
import { EditTaskView, NewTaskView, TaskDetailView } from '@/features/tasks/TaskViews';
import { router } from './support/setup';
import { apiError, json, mockApi, on, PROJECT, renderWithClient, TASK } from './support/test-utils';

const EDITABLE_KEYS = ['description', 'dueDate', 'name', 'priority', 'status'];

describe('toTaskUpdateBody', () => {
  it('returns exactly the five editable fields with the change applied', () => {
    const body = toTaskUpdateBody(TASK, { status: 'COMPLETED' });
    expect(body).toEqual({ name: TASK.name, description: TASK.description, priority: 'MEDIUM', status: 'COMPLETED', dueDate: '2026-10-20' });
    expect(Object.keys(body).sort()).toEqual(EDITABLE_KEYS);
  });

  it('can clear nullable fields', () => {
    expect(toTaskUpdateBody(TASK, { dueDate: null, description: null })).toMatchObject({ dueDate: null, description: null });
  });
});

describe('task list', () => {
  const routes = (tasks = [TASK]) => [on('GET', '/api/tasks', () => json(200, tasks)), on('GET', '/api/projects', () => json(200, [PROJECT]))];

  it('lists tasks with their project and sends filters to the API', async () => {
    const { requests } = mockApi(...routes());
    renderWithClient(<TaskListSection title="Your tasks" />);
    expect(await screen.findByRole('link', { name: TASK.name })).toHaveAttribute('href', `/tasks/${TASK.id}`);
    expect(await screen.findByRole('link', { name: PROJECT.name })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search by name'), 'copy');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PENDING');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'HIGH');
    await userEvent.selectOptions(screen.getByLabelText('Project'), PROJECT.id);
    await waitFor(() => {
      const query = requests.filter((r) => r.path === '/api/tasks').at(-1)!.query;
      expect(Object.fromEntries(query)).toEqual({ search: 'copy', status: 'PENDING', priority: 'HIGH', projectId: PROJECT.id });
    });
  });

  it('uses the fixed project on a project page', async () => {
    const { requests } = mockApi(...routes());
    renderWithClient(<TaskListSection projectId={PROJECT.id} title="Tasks in this project" />);
    await screen.findByRole('link', { name: TASK.name });
    expect(requests.find((r) => r.path === '/api/tasks')!.query.get('projectId')).toBe(PROJECT.id);
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New task' })).toHaveAttribute('href', `/tasks/new?projectId=${PROJECT.id}`);
  });

  it('shows distinct empty states', async () => {
    mockApi(...routes([]));
    renderWithClient(<TaskListSection title="Your tasks" />);
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'LOW');
    expect(await screen.findByText('No tasks match your filters')).toBeInTheDocument();
  });

  it('marks a task complete with a full PUT body', async () => {
    const { requests } = mockApi(
      ...routes(),
      on('PUT', `/api/tasks/${TASK.id}`, (r) => json(200, { ...TASK, ...(r.body as object) })),
    );
    renderWithClient(<TaskListSection title="Your tasks" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mark complete' }));
    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    const put = requests.find((r) => r.method === 'PUT')!;
    expect(put.body).toEqual({ name: TASK.name, description: TASK.description, priority: 'MEDIUM', status: 'COMPLETED', dueDate: '2026-10-20' });
  });

  it('changes status and priority with full PUT bodies', async () => {
    const { requests } = mockApi(
      ...routes(),
      on('PUT', `/api/tasks/${TASK.id}`, (r) => json(200, { ...TASK, ...(r.body as object) })),
    );
    renderWithClient(<TaskListSection title="Your tasks" />);
    await userEvent.selectOptions(await screen.findByLabelText(`Priority for ${TASK.name}`), 'HIGH');
    await userEvent.selectOptions(screen.getByLabelText(`Status for ${TASK.name}`), 'IN_PROGRESS');
    await waitFor(() => expect(requests.filter((r) => r.method === 'PUT')).toHaveLength(2));
    const [first, second] = requests.filter((r) => r.method === 'PUT');
    expect(first!.body).toMatchObject({ priority: 'HIGH', status: 'PENDING' });
    expect(second!.body).toMatchObject({ status: 'IN_PROGRESS' });
    for (const put of [first!, second!]) {
      expect(Object.keys(put.body as object).sort()).toEqual(EDITABLE_KEYS);
    }
  });

  it('shows an error when a quick action fails', async () => {
    mockApi(...routes(), on('PUT', `/api/tasks/${TASK.id}`, () => apiError(404, 'NOT_FOUND', 'Task not found.')));
    renderWithClient(<TaskListSection title="Your tasks" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mark complete' }));
    expect(await screen.findByText(/Could not update the task: Task not found\./)).toBeInTheDocument();
  });
});

describe('create, edit and delete', () => {
  it('requires a project when creating a task', async () => {
    const { requests } = mockApi(on('GET', '/api/projects', () => json(200, [PROJECT])));
    renderWithClient(<NewTaskView />);
    await userEvent.type(await screen.findByLabelText(/Name/), 'New task');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Choose a project.')).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('creates a task in the chosen project', async () => {
    const { requests } = mockApi(
      on('GET', '/api/projects', () => json(200, [PROJECT])),
      on('POST', '/api/tasks', () => json(201, TASK)),
    );
    renderWithClient(<NewTaskView defaultProjectId={PROJECT.id} />);
    await userEvent.type(await screen.findByLabelText(/Name/), 'Draft homepage copy');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'HIGH');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/tasks/${TASK.id}`));
    expect(requests.find((r) => r.method === 'POST')!.body).toEqual({
      projectId: PROJECT.id,
      name: 'Draft homepage copy',
      description: null,
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: null,
    });
  });

  it('asks to create a project first when there are none', async () => {
    mockApi(on('GET', '/api/projects', () => json(200, [])));
    renderWithClient(<NewTaskView />);
    expect(await screen.findByText('Create a project first')).toBeInTheDocument();
  });

  it('edits without letting the project change: the PUT body never contains projectId', async () => {
    const { requests } = mockApi(
      on('GET', `/api/tasks/${TASK.id}`, () => json(200, TASK)),
      on('GET', `/api/projects/${PROJECT.id}`, () => json(200, PROJECT)),
      on('PUT', `/api/tasks/${TASK.id}`, (r) => json(200, { ...TASK, ...(r.body as object) })),
    );
    renderWithClient(<EditTaskView taskId={TASK.id} />);
    expect(await screen.findByText(PROJECT.name)).toBeInTheDocument();
    expect(screen.getByText('A task stays in the project it was created in.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Project/ })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/Due date/));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/tasks/${TASK.id}`));
    const put = requests.find((r) => r.method === 'PUT')!;
    expect(Object.keys(put.body as object).sort()).toEqual(EDITABLE_KEYS);
    expect(put.body).toMatchObject({ dueDate: null });
  });

  it('deletes a task only after confirmation', async () => {
    const { requests } = mockApi(
      on('GET', `/api/tasks/${TASK.id}`, () => json(200, TASK)),
      on('GET', `/api/projects/${PROJECT.id}`, () => json(200, PROJECT)),
      on('DELETE', `/api/tasks/${TASK.id}`, () => json(204)),
    );
    renderWithClient(<TaskDetailView taskId={TASK.id} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete task?' });
    expect(requests.some((r) => r.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/projects/${PROJECT.id}`));
    expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(1);
  });

  it('shows "Task not found" for a 404', async () => {
    mockApi(on('GET', `/api/tasks/${TASK.id}`, () => apiError(404, 'NOT_FOUND', 'Task not found.')));
    renderWithClient(<TaskDetailView taskId={TASK.id} />);
    expect(await screen.findByRole('heading', { name: 'Task not found' })).toBeInTheDocument();
  });
});
