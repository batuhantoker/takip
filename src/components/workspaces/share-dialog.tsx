'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAccess } from '@/lib/access';
import { shareUrl } from '@/lib/workspaces/api';
import { workspaceParts } from '@/lib/workspaces/parts';
import { workspaceSession } from '@/lib/workspaces/session';
import { showAccountDialog } from '@/components/account/account-dialog-state';
import { FormError, INPUT } from '@/components/account/form-parts';
import { SmallButton } from '@/components/account/settings/settings-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { describeWorkspaceFailure } from './messages';
import { useWorkspace } from './use-workspace';
import { showWorkspaceDialog } from './workspace-dialog-state';

/** Replay's moment when replaying, else now: the link opens there. */
function momentOnScreen() {
  const time = workspaceParts.capture().time;
  return time?.mode === 'replay' ? time.t : Date.now();
}

const when = (t: number) => new Date(t).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const { current } = useWorkspace();
  const access = useAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Taken when the dialog opens, so the link doesn't drift while replay plays.
  const [moment] = useState(momentOnScreen);
  const [atMoment, setAtMoment] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async (action: () => Promise<{ error: string; status: number } | null>) => {
    setBusy(true);
    setError(null);
    setCopied(false);
    const failure = await action();
    setBusy(false);
    if (failure) setError(describeWorkspaceFailure(failure));
  };

  if (!current) {
    return (
      <DialogFrame title="Share link" onClose={onClose}>
        <Hint>Save this view as a workspace first; then it can have a link.</Hint>
        <SmallButton onClick={() => showWorkspaceDialog({ kind: 'name', mode: 'save-as' })}>Save as…</SmallButton>
      </DialogFrame>
    );
  }

  if (access && !access.entitlements['workspaces.share']) {
    return (
      <DialogFrame title="Share link" onClose={onClose}>
        <Hint>Share links aren&apos;t part of your plan. A plan with them lets anyone you send a link view this workspace, read-only.</Hint>
        <SmallButton onClick={() => showAccountDialog({ kind: 'settings' })}>See plans</SmallButton>
      </DialogFrame>
    );
  }

  const url = current.shareSlug ? shareUrl(window.location.origin, current.shareSlug, atMoment ? moment : undefined) : null;
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Copying was blocked. Select the link and copy it yourself.');
    }
  };

  return (
    <DialogFrame title={`Share “${current.name}”`} onClose={onClose}>
      <Hint>Anyone with the link can view this workspace as last saved, read-only. They don&apos;t see who made it, your recent places or your watchlist.</Hint>
      {url ? (
        <>
          <div className="flex items-center gap-2">
            <input readOnly value={url} aria-label="Share link" onFocus={e => e.currentTarget.select()} className={`${INPUT} flex-1 min-w-0`} />
            <SmallButton onClick={copy} aria-label="Copy link">
              {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
            </SmallButton>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[var(--text-primary)]">
            <input type="checkbox" checked={atMoment} onChange={e => setAtMoment(e.target.checked)} className="accent-[var(--gold-primary)]" />
            Open in replay at {when(moment)}
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <SmallButton disabled={busy} onClick={() => run(() => workspaceSession().share())}>New link</SmallButton>
            <SmallButton danger disabled={busy} onClick={() => run(() => workspaceSession().unshare())}>Stop sharing</SmallButton>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">A new link or stopping sharing makes the current link stop working at once.</p>
        </>
      ) : (
        <SmallButton disabled={busy} onClick={() => run(() => workspaceSession().share())}>{busy ? 'Creating…' : 'Create link'}</SmallButton>
      )}
      <FormError message={error} />
    </DialogFrame>
  );
}
