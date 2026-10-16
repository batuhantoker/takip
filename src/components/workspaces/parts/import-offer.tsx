'use client';

import { useState } from 'react';
import { IMPORTED_NAME } from '@/lib/platform/workspaces/device';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { FormError } from '@/components/site/account/form-parts';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { describeWorkspaceFailure } from '@/components/workspaces/messages';

/** The first sign-in on a device: once, whatever the answer. */
export default function ImportOffer() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = workspaceSession();

  const accept = async () => {
    setBusy(true);
    const failure = await session.acceptImport();
    setBusy(false);
    if (failure) setError(describeWorkspaceFailure(failure));
  };

  return (
    <DialogFrame title="Keep this view in your account?" onClose={session.declineImport}>
      <Hint>
        This device remembers your layers, drawn areas, recent places and watchlist. Save them to your account as “{IMPORTED_NAME}” to
        open them on any device. It keeps saving as you work.
      </Hint>
      <div className="flex flex-wrap gap-2">
        <SmallButton onClick={session.declineImport}>Not now</SmallButton>
        <SmallButton disabled={busy} onClick={accept}>{busy ? 'Saving…' : 'Save to my account'}</SmallButton>
      </div>
      <p className="text-[11px] text-ink-3">Asked once on this device. The workspace menu can do it later.</p>
      <FormError message={error} />
    </DialogFrame>
  );
}
