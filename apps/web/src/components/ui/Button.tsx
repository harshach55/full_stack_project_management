import Link, { type LinkProps } from 'next/link';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-700 hover:bg-slate-100',
};

export function buttonClasses(variant: Variant = 'primary', extra = ''): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Button that is disabled and shows a spinner while `loading`, preventing double submits. */
export function Button({ variant = 'primary', loading = false, disabled, className = '', children, type = 'button', ref, ...rest }: ButtonProps) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ variant = 'primary', className = '', children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, className)} {...rest}>
      {children}
    </Link>
  );
}
