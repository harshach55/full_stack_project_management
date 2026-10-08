import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DeleteProjectButton } from '@/features/projects/DeleteProjectButton';
import { ProjectDetailView } from '@/features/projects/ProjectDetailView';
import { NewProjectView, EditProjectView } from '@/features/projects/ProjectEditorViews';
import { ProjectsView } from '@/features/projects/ProjectsView';
import { router } from './support/setup';
import { apiError, json, mockApi, on, PROJECT, renderWithClient } from './support/test-utils';

const SECOND = { ...PROJECT, id: '44444444-4444-4444-8444-444444444444', name: 'Mobile app', status: 'NOT_STARTED' as const };

describe('project list', () => {
  it('shows projects returned by the API', async () => {
    mockApi(on('GET', '/api/projects', () => json(200, [PROJECT, SECOND])));
    renderWithClient(<ProjectsView />);
    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('Website Redesign')).toBeInTheDocument();
    expect(within(items[0]!).getByText('In progress')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Oct 1, 2026')).toBeInTheDocument();
  });

  it('sends search and status filters to the API and can reset them', async () => {
    const { requests } = mockApi(on('GET', '/api/projects', () => json(200, [PROJECT])));
    renderWithClient(<ProjectsView />);
    await screen.findByText('Website Redesign');

    await userEvent.type(screen.getByLabelText('Search by name'), 'web');
    await waitFor(() => expect(requests.at(-1)!.query.get('search')).toBe('web'));

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'IN_PROGRESS');
    await waitFor(() => expect(requests.at(-1)!.query.get('status')).toBe('IN_PROGRESS'));
    expect(requests.at(-1)!.query.get('search')).toBe('web');

    // Reset clears both inputs; the unfiltered list is served from the cache of the first request.
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByLabelText('Search by name')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(requests[0]!.query.toString()).toBe('');
    expect(await screen.findByText('Website Redesign')).toBeInTheDocument();
  });

  it('distinguishes "no projects yet" from "no matches"', async () => {
    mockApi(on('GET', '/api/projects', () => json(200, [])));
    renderWithClient(<ProjectsView />);
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create project' })).toHaveAttribute('href', '/projects/new');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'COMPLETED');
    expect(await screen.findByText('No projects match your filters')).toBeInTheDocument();
  });

  it('shows an error with a retry option', async () => {
    mockApi(on('GET', '/api/projects', () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')));
    renderWithClient(<ProjectsView />);
    expect(await screen.findByText('Could not load projects', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('create and edit', () => {
  it('validates dates with the shared rule before sending', async () => {
    const { requests } = mockApi();
    renderWithClient(<NewProjectView />);
    await userEvent.type(screen.getByLabelText(/Name/), 'Launch');
    await userEvent.type(screen.getByLabelText('Start date'), '2026-10-10');
    await userEvent.type(screen.getByLabelText('End date'), '2026-10-09');
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('End date must be on or after the start date.')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('creates a project without server-owned fields', async () => {
    const { requests } = mockApi(on('POST', '/api/projects', () => json(201, PROJECT)));
    renderWithClient(<NewProjectView />);
    await userEvent.type(screen.getByLabelText(/Name/), '  Launch  ');
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/projects/${PROJECT.id}`));
    expect(requests[0]!.body).toEqual({ name: 'Launch', description: null, status: 'NOT_STARTED', startDate: null, endDate: null });
  });

  it('edits with a full PUT body and shows server validation errors on fields', async () => {
    const { requests } = mockApi(
      on('GET', `/api/projects/${PROJECT.id}`, () => json(200, PROJECT)),
      on('PUT', `/api/projects/${PROJECT.id}`, () =>
        apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [{ location: 'body', path: 'name', message: 'Name must be at most 120 characters.' }]),
      ),
    );
    renderWithClient(<EditProjectView projectId={PROJECT.id} />);
    const name = await screen.findByLabelText(/Name/);
    expect(name).toHaveValue('Website Redesign');
    await userEvent.clear(screen.getByLabelText('End date'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Name must be at most 120 characters.')).toBeInTheDocument();
    const put = requests.find((r) => r.method === 'PUT')!;
    expect(put.body).toEqual({
      name: 'Website Redesign',
      description: 'New landing page',
      status: 'IN_PROGRESS',
      startDate: '2026-10-01',
      endDate: null,
    });
  });
});

describe('delete', () => {
  it('asks for confirmation, warns about tasks, and deletes only after confirming', async () => {
    const { requests } = mockApi(on('DELETE', `/api/projects/${PROJECT.id}`, () => json(204)));
    renderWithClient(<DeleteProjectButton projectId={PROJECT.id} projectName={PROJECT.name} />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete project?' });
    expect(dialog).toHaveTextContent('all of its tasks will be permanently deleted');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/projects'));
    expect(requests).toEqual([expect.objectContaining({ method: 'DELETE', path: `/api/projects/${PROJECT.id}` })]);
  });

  it('keeps the dialog open and shows an error when the delete fails', async () => {
    mockApi(on('DELETE', `/api/projects/${PROJECT.id}`, () => apiError(404, 'NOT_FOUND', 'Project not found.')));
    renderWithClient(<DeleteProjectButton projectId={PROJECT.id} projectName={PROJECT.name} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(await screen.findByText('Project not found.')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('project detail', () => {
  it('shows "Project not found" for a 404 (missing or another user\'s project)', async () => {
    mockApi(
      on('GET', `/api/projects/${PROJECT.id}`, () => apiError(404, 'NOT_FOUND', 'Project not found.')),
      on('GET', '/api/tasks', () => json(200, [])),
      on('GET', '/api/projects', () => json(200, [])),
    );
    renderWithClient(<ProjectDetailView projectId={PROJECT.id} />);
    expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
