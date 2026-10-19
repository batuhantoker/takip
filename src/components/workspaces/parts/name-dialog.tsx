'use client';

import { useState, type FormEvent } from 'react';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { Field, FormError, Submit } from '@/components/site/account/form-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { describeWorkspaceFailure } from '@/components/workspaces/messages';
import { useWorkspace } from '@/components/workspaces/use-workspace';
import { countAction } from '@/lib/platform/usage-actions';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';

const COPY = {
  'save-as': { title: msg('Save as'), hint: msg('Saves what the map shows now as a new workspace, and switches to it.'), submit: msg('Save') },
  new: { title: msg('New workspace'), hint: msg('Starts a workspace from what the map shows now. The one open now keeps what it last saved.'), submit: msg('Create') },
  copy: { title: msg('Save a copy'), hint: msg('Saves this shared view to your account as your own workspace. The original stays as it is.'), submit: msg('Save copy') },
} as const;

export default function NameDialog({ mode, onClose }: { mode: keyof typeof COPY; onClose: () => void }) {
  const t = useT();
  const { current, shared } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];
  const suggested = mode === 'copy' ? shared?.name : mode === 'save-as' && current ? t('{name} copy', { name: current.name }) : '';

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get('name')).trim();
    setBusy(true);
    setError(null);
    const failure = await workspaceSession().saveAs(name);
    setBusy(false);
    if (failure) return setError(describeWorkspaceFailure(failure, t));
    countAction('workspace.save');
    onClose();
  };

  return (
    <DialogFrame title={t(copy.title)} onClose={onClose}>
      <Hint>{t(copy.hint)}</Hint>
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <Field label={t('Name')} name="name" maxLength={80} defaultValue={suggested} placeholder={t('e.g. Black Sea shipping')} autoFocus />
        <FormError message={error} />
        <Submit busy={busy}>{t(copy.submit)}</Submit>
      </form>
    </DialogFrame>
  );
}
