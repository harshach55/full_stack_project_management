import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you are looking for does not exist.</p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
      </div>
    </main>
  );
}
