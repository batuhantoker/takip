'use client';

import { useState } from 'react';
import type { WorkspaceFailure } from '@/lib/platform/workspaces/api';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { FormError } from '@/components/site/account/form-parts';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';
import DialogFrame, { Hint } from './dialog-frame';
import { describeWorkspaceFailure } from '@/components/workspaces/messages';

/** An explicit Save found the workspace changed elsewhere since this device read it. */
export default function ConflictDialog({ name }: { name: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = workspaceSession();

  const choose = async (action: () => Promise<WorkspaceFailure | null>) => {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) setError(describeWorkspaceFailure(failure, t));
  };

  return (
    <DialogFrame title={t('Changed elsewhere')} onClose={session.dismissProblem}>
      <Hint>{t('“{name}” was saved from another device or tab since you opened it here. Keep what this map shows, or switch to the saved version.', { name })}</Hint>
      <div className="flex flex-wrap gap-2">
        <SmallButton disabled={busy} onClick={() => choose(session.reload)}>{t('Use the saved one')}</SmallButton>
        <SmallButton disabled={busy} onClick={() => choose(session.overwrite)}>{t('Keep mine')}</SmallButton>
      </div>
      <FormError message={error} />
    </DialogFrame>
  );
}
