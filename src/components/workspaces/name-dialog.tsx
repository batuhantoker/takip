'use client';

import { useState, type FormEvent } from 'react';
import { workspaceSession } from '@/lib/workspaces/session';
import { Field, FormError, Submit } from '@/components/account/form-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { describeWorkspaceFailure } from './messages';
import { useWorkspace } from './use-workspace';

const COPY = {
  'save-as': { title: 'Save as', hint: 'Saves what the map shows now as a new workspace, and switches to it.', submit: 'Save' },
  new: { title: 'New workspace', hint: 'Starts a workspace from what the map shows now. The one open now keeps what it last saved.', submit: 'Create' },
  copy: { title: 'Save a copy', hint: 'Saves this shared view to your account as your own workspace. The original stays as it is.', submit: 'Save copy' },
} as const;

export default function NameDialog({ mode, onClose }: { mode: keyof typeof COPY; onClose: () => void }) {
  const { current, shared } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];
  const suggested = mode === 'copy' ? shared?.name : mode === 'save-as' && current ? `${current.name} copy` : '';

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get('name')).trim();
    setBusy(true);
    setError(null);
    const failure = await workspaceSession().saveAs(name);
    setBusy(false);
    if (failure) return setError(describeWorkspaceFailure(failure));
    onClose();
  };

  return (
    <DialogFrame title={copy.title} onClose={onClose}>
      <Hint>{copy.hint}</Hint>
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <Field label="Name" name="name" maxLength={80} defaultValue={suggested} placeholder="e.g. Black Sea shipping" autoFocus />
        <FormError message={error} />
        <Submit busy={busy}>{copy.submit}</Submit>
      </form>
    </DialogFrame>
  );
}
