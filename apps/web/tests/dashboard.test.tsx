import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthGate } from '@/features/auth/AuthGate';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { apiError, json, mockApi, on, renderWithClient, USER } from './support/test-utils';

const COUNTS = { totalProjects: 4, projectsInProgress: 2, totalTasks: 17, completedTasks: 6, pendingTasks: 8, inProgressTasks: 3 };

function renderDashboard() {
  return renderWithClient(
    <AuthGate>
      <DashboardView />
    </AuthGate>,
  );
}

describe('DashboardView', () => {
  it('shows the six metrics from GET /api/dashboard', async () => {
    const { requests } = mockApi(
      on('GET', '/api/auth/me', () => json(200, { user: USER })),
      on('GET', '/api/dashboard', () => json(200, COUNTS)),
    );
    renderDashboard();
    expect(await screen.findByText('Total projects')).toBeInTheDocument();
    for (const [label, key, value] of [
      ['Total projects', 'totalProjects', 4],
      ['Projects in progress', 'projectsInProgress', 2],
      ['Total tasks', 'totalTasks', 17],
      ['Completed tasks', 'completedTasks', 6],
      ['Pending tasks', 'pendingTasks', 8],
      ['In-progress tasks', 'inProgressTasks', 3],
    ] as const) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByTestId(`metric-${key}`)).toHaveTextContent(String(value));
    }
    // Counts come from the dashboard endpoint, not from loading the lists.
    expect(requests.map((r) => r.path).sort()).toEqual(['/api/auth/me', '/api/dashboard']);
  });

  it('shows an error state with retry', async () => {
    mockApi(
      on('GET', '/api/auth/me', () => json(200, { user: USER })),
      on('GET', '/api/dashboard', () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')),
    );
    renderDashboard();
    expect(await screen.findByText('Could not load the dashboard', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
