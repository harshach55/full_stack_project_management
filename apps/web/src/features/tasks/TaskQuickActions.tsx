'use client';

import type { Task, TaskPriority, TaskStatus } from '@pm/shared';
import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/lib/error-messages';
import { useUpdateTask } from './hooks';
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from './labels';
import { toTaskUpdateBody } from './task-body';

const selectClasses =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-2 focus:outline-blue-600 disabled:bg-slate-100';

/**
 * Mark complete, change status and change priority. Each action sends the complete
 * editable representation through PUT with only one field changed (PD-07).
 */
export function TaskQuickActions({ task }: { task: Task }) {
  const statusId = useId();
  const priorityId = useId();
  const updateTask = useUpdateTask();

  const save = (changes: { status?: TaskStatus; priority?: TaskPriority }) =>
    updateTask.mutate({ id: task.id, body: toTaskUpdateBody(task, changes) });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {task.status !== 'COMPLETED' && (
          <Button variant="secondary" className="px-3 py-1.5" onClick={() => save({ status: 'COMPLETED' })} disabled={updateTask.isPending}>
            Mark complete
          </Button>
        )}
        <label htmlFor={statusId} className="sr-only">
          Status for {task.name}
        </label>
        <select
          id={statusId}
          className={selectClasses}
          value={task.status}
          disabled={updateTask.isPending}
          onChange={(event) => save({ status: event.target.value as TaskStatus })}
        >
          {TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label htmlFor={priorityId} className="sr-only">
          Priority for {task.name}
        </label>
        <select
          id={priorityId}
          className={selectClasses}
          value={task.priority}
          disabled={updateTask.isPending}
          onChange={(event) => save({ priority: event.target.value as TaskPriority })}
        >
          {TASK_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} priority
            </option>
          ))}
        </select>
      </div>
      {updateTask.isError && (
        <p role="alert" className="text-sm text-red-700">
          Could not update the task: {errorMessage(updateTask.error)}
        </p>
      )}
    </div>
  );
}
