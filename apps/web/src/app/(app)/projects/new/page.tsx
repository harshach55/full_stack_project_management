import type { Metadata } from 'next';
import { NewProjectView } from '@/features/projects/ProjectEditorViews';

export const metadata: Metadata = { title: 'New project' };

export default function NewProjectPage() {
  return <NewProjectView />;
}
