'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert } from '@/components/ui/States';
import { errorMessage } from '@/lib/error-messages';
import { useDeleteProject } from './hooks';

/** Delete with an explicit confirmation that warns about the project's tasks (PD-09). */
export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const deleteProject = useDeleteProject();

  const confirm = () => {
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        setOpen(false);
        router.replace('/projects');
      },
    });
  };

  const cancel = () => {
    setOpen(false);
    deleteProject.reset();
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete project?"
        confirmLabel="Delete project"
        onConfirm={confirm}
        onCancel={cancel}
        loading={deleteProject.isPending}
      >
        <p>
          <strong className="break-words">{projectName}</strong> and all of its tasks will be permanently deleted. This
          cannot be undone.
        </p>
        {deleteProject.isError && (
          <div className="mt-3">
            <Alert>{errorMessage(deleteProject.error)}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
