'use client';

import {
  LIMITS,
  taskCreateBodySchema,
  taskUpdateBodySchema,
  type Project,
  type Task,
  type TaskCreateInput,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdateInput,
} from '@pm/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Fields';
import { Alert } from '@/components/ui/States';
import { errorMessage, serverFieldErrors } from '@/lib/error-messages';
import { dateInputToValue, validateForm, type FieldErrors } from '@/lib/form';
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from './labels';

type TaskFormProps =
  | {
      mode: 'create';
      projects: Project[];
      defaultProjectId?: string;
      submitting: boolean;
      onSubmit: (values: TaskCreateInput) => Promise<unknown>;
      onCancel: () => void;
    }
  | {
      mode: 'edit';
      task: Task;
      projectName: string;
      submitting: boolean;
      onSubmit: (values: TaskUpdateInput) => Promise<unknown>;
      onCancel: () => void;
    };

/**
 * Task form. Creating requires choosing one of the user's projects. Editing shows the project
 * read-only: a task cannot move to another project (PD-08), so the update body contains
 * only the five editable fields.
 */
export function TaskForm(props: TaskFormProps) {
  const initial = props.mode === 'edit' ? props.task : undefined;
  const [projectId, setProjectId] = useState(props.mode === 'create' ? (props.defaultProjectId ?? '') : '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'MEDIUM');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'PENDING');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);

  const editable = { name, description, priority, status, dueDate: dateInputToValue(dueDate) };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result =
      props.mode === 'create'
        ? validateForm(taskCreateBodySchema, { projectId, ...editable })
        : validateForm(taskUpdateBodySchema, editable);
    if (!result.success) {
      // A missing project selection reads better than "Invalid id".
      if (props.mode === 'create' && projectId === '') result.errors.projectId = 'Choose a project.';
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    try {
      if (props.mode === 'create') await props.onSubmit(result.data as TaskCreateInput);
      else await props.onSubmit(result.data as TaskUpdateInput);
    } catch (error) {
      const fieldErrors = serverFieldErrors(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setSubmitError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {submitError !== null && <Alert>{errorMessage(submitError)}</Alert>}
      {props.mode === 'create' ? (
        <SelectField label="Project" value={projectId} onChange={(event) => setProjectId(event.target.value)} error={errors.projectId} required>
          <option value="">Choose a project</option>
          {props.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <div>
          <p className="text-sm font-medium text-slate-800">Project</p>
          <p className="mt-1 break-words text-sm text-slate-700">{props.projectName}</p>
          <p className="text-xs text-slate-500">A task stays in the project it was created in.</p>
        </div>
      )}
      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} maxLength={LIMITS.nameMax} required />
      <TextAreaField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors.description}
        maxLength={LIMITS.descriptionMax}
        hint="Optional."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} error={errors.priority}>
          {TASK_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} error={errors.status}>
          {TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} error={errors.dueDate} hint="Optional." />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={props.onCancel} disabled={props.submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={props.submitting}>
          {props.mode === 'create' ? 'Create task' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
