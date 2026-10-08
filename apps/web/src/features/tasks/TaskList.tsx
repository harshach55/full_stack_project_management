'use client';

import type { Task } from '@pm/shared';
import Link from 'next/link';
import { formatDate } from '@/lib/dates';
import { TaskPriorityBadge, TaskStatusBadge } from './labels';
import { TaskQuickActions } from './TaskQuickActions';

interface TaskListProps {
  tasks: Task[];
  /** Project names by id, shown when the list spans several projects. */
  projectNames?: Map<string, string>;
}

export function TaskList({ tasks, projectNames }: TaskListProps) {
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link href={`/tasks/${task.id}`} className="break-words font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                {task.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <TaskStatusBadge status={task.status} />
                <TaskPriorityBadge priority={task.priority} />
                {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
                {projectNames && (
                  <span className="break-words">
                    Project:{' '}
                    <Link href={`/projects/${task.projectId}`} className="text-blue-700 hover:underline">
                      {projectNames.get(task.projectId) ?? 'View project'}
                    </Link>
                  </span>
                )}
              </div>
            </div>
            <TaskQuickActions task={task} />
          </div>
        </li>
      ))}
    </ul>
  );
}
