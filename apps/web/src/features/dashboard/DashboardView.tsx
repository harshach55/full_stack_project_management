'use client';

import type { DashboardResponse } from '@pm/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { useAuthenticatedUser } from '@/features/auth/AuthGate';
import { apiRequest } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const getDashboard = (signal?: AbortSignal) => apiRequest<DashboardResponse>('/dashboard', { signal });

interface Metric {
  key: keyof DashboardResponse;
  label: string;
  href: string;
}

/** The six statistics from GET /api/dashboard (DASH-01); the counts come from the API, not from local lists. */
const METRICS: Metric[] = [
  { key: 'totalProjects', label: 'Total projects', href: '/projects' },
  { key: 'projectsInProgress', label: 'Projects in progress', href: '/projects' },
  { key: 'totalTasks', label: 'Total tasks', href: '/tasks' },
  { key: 'completedTasks', label: 'Completed tasks', href: '/tasks' },
  { key: 'pendingTasks', label: 'Pending tasks', href: '/tasks' },
  { key: 'inProgressTasks', label: 'In-progress tasks', href: '/tasks' },
];

export function DashboardView() {
  const user = useAuthenticatedUser();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => getDashboard(signal),
  });

  return (
    <>
      <PageHeader title="Dashboard" description={`Welcome, ${user.fullName}.`} />
      {isPending ? (
        <LoadingState label="Loading dashboard..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the dashboard" />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METRICS.map((metric) => (
            <li key={metric.key}>
              <Link
                href={metric.href}
                className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900" data-testid={`metric-${metric.key}`}>
                  {data[metric.key]}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
