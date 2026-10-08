'use client';

import { LIMITS, projectUpdateBodySchema, type Project, type ProjectStatus, type ProjectUpdateInput } from '@pm/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Fields';
import { Alert } from '@/components/ui/States';
import { errorMessage, serverFieldErrors } from '@/lib/error-messages';
import { dateInputToValue, validateForm, type FieldErrors } from '@/lib/form';
import { PROJECT_STATUS_OPTIONS } from './labels';

interface ProjectFormProps {
  initial?: Project;
  submitLabel: string;
  submitting: boolean;
  /** Receives the complete editable representation; rejects with the API error on failure. */
  onSubmit: (values: ProjectUpdateInput) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * Create and edit form. It always produces all five editable fields (the full PUT body), and
 * never server-owned fields such as id, ownerId or timestamps. Validation uses the same
 * shared schema as the API, including endDate >= startDate.
 */
export function ProjectForm({ initial, submitLabel, submitting, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'NOT_STARTED');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(projectUpdateBodySchema, {
      name,
      description,
      status,
      startDate: dateInputToValue(startDate),
      endDate: dateInputToValue(endDate),
    });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    try {
      await onSubmit(result.data);
    } catch (error) {
      const fieldErrors = serverFieldErrors(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setSubmitError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {submitError !== null && <Alert>{errorMessage(submitError)}</Alert>}
      <TextField
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
        maxLength={LIMITS.nameMax}
        required
      />
      <TextAreaField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors.description}
        maxLength={LIMITS.descriptionMax}
        hint="Optional."
      />
      <SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)} error={errors.status}>
        {PROJECT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Start date"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          error={errors.startDate}
          hint="Optional."
        />
        <TextField
          label="End date"
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => setEndDate(event.target.value)}
          error={errors.endDate}
          hint="Optional. On or after the start date."
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
