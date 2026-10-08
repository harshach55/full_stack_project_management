export function Spinner({ size = 'md', label }: { size?: 'sm' | 'md'; label?: string }) {
  const dimension = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`${dimension} animate-spin rounded-full border-2 border-current border-t-transparent opacity-70`}
      />
      {label && <span className="text-sm text-slate-600">{label}</span>}
    </span>
  );
}

/** Centered loading indicator for a whole page or section. */
export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex justify-center py-12 text-slate-500">
      <Spinner label={label} />
    </div>
  );
}
