'use client';

import { useState } from 'react';
import type { WorkspaceFailure } from '@/lib/workspaces/api';
import { workspaceSession } from '@/lib/workspaces/session';
import { FormError } from '@/components/account/form-parts';
import { SmallButton } from '@/components/account/settings/settings-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { describeWorkspaceFailure } from './messages';

/** An explicit Save found the workspace changed elsewhere since this device read it. */
export default function ConflictDialog({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = workspaceSession();

  const choose = async (action: () => Promise<WorkspaceFailure | null>) => {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) setError(describeWorkspaceFailure(failure));
  };

  return (
    <DialogFrame title="Changed elsewhere" onClose={session.dismissProblem}>
      <Hint>“{name}” was saved from another device or tab since you opened it here. Keep what this map shows, or switch to the saved version.</Hint>
      <div className="flex flex-wrap gap-2">
        <SmallButton disabled={busy} onClick={() => choose(session.reload)}>Use the saved one</SmallButton>
        <SmallButton disabled={busy} onClick={() => choose(session.overwrite)}>Keep mine</SmallButton>
      </div>
      <FormError message={error} />
    </DialogFrame>
  );
}
