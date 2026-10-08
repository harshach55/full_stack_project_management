import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const control =
  'block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 disabled:bg-slate-100';

function controlClasses(error?: string): string {
  return `${control} ${error ? 'border-red-500' : 'border-slate-300'}`;
}

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/** Label, control, hint and error message wired together with aria attributes. */
function FieldShell({ id, label, error, hint, required, children }: FieldShellProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface CommonProps {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, required, ...rest }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <input
        id={id}
        className={controlClasses(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, error, hint, required, ...rest }: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <textarea
        id={id}
        rows={4}
        className={controlClasses(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({ label, error, hint, required, children, ...rest }: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <select
        id={id}
        className={controlClasses(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
