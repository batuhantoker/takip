'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAccess } from '@/components/site/account/use-access';
import { shareUrl } from '@/lib/platform/workspaces/api';
import { workspaceParts } from '@/lib/platform/workspaces/parts';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { FormError, INPUT } from '@/components/site/account/form-parts';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { countAction } from '@/lib/platform/usage-actions';
import { describeWorkspaceFailure } from '@/components/workspaces/messages';
import { useWorkspace } from '@/components/workspaces/use-workspace';
import { showWorkspaceDialog } from '@/components/workspaces/workspace-dialog-state';
import { useT } from '@/components/ui/use-t';

/** Replay's moment when replaying, else now: the link opens there. */
function momentOnScreen() {
  const time = workspaceParts.capture().time;
  return time?.mode === 'replay' ? time.t : Date.now();
}

const when = (time: number, intl: string) => new Date(time).toLocaleString(intl, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
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
    if (failure) setError(describeWorkspaceFailure(failure, t));
  };

  if (!current) {
    return (
      <DialogFrame title={t('Share link')} onClose={onClose}>
        <Hint>{t('Save this view as a workspace first; then it can have a link.')}</Hint>
        <SmallButton onClick={() => showWorkspaceDialog({ kind: 'name', mode: 'save-as' })}>{t('Save as…')}</SmallButton>
      </DialogFrame>
    );
  }

  if (access && !access.entitlements['workspaces.share']) {
    return (
      <DialogFrame title={t('Share link')} onClose={onClose}>
        <Hint>{t("Share links aren't part of your plan. A plan with them lets anyone you send a link view this workspace, read-only.")}</Hint>
        <SmallButton onClick={() => showAccountDialog({ kind: 'settings' })}>{t('See plans')}</SmallButton>
      </DialogFrame>
    );
  }

  const url = current.shareSlug ? shareUrl(window.location.origin, current.shareSlug, atMoment ? moment : undefined) : null;
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      countAction('workspace.share');
      setCopied(true);
    } catch {
      setError(t('Copying was blocked. Select the link and copy it yourself.'));
    }
  };

  return (
    <DialogFrame title={t('Share “{name}”', { name: current.name })} onClose={onClose}>
      <Hint>{t("Anyone with the link can view this workspace as last saved, read-only. They don't see who made it, your recent places or your watchlist.")}</Hint>
      {url ? (
        <>
          <div className="flex items-center gap-2">
            <input readOnly value={url} aria-label={t('Share link')} onFocus={e => e.currentTarget.select()} className={`${INPUT} flex-1 min-w-0`} />
            <SmallButton onClick={copy} aria-label={t('Copy link')}>
              {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
            </SmallButton>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-1">
            <input type="checkbox" checked={atMoment} onChange={e => setAtMoment(e.target.checked)} className="accent-[var(--accent)]" />
            {t('Open in replay at {time}', { time: when(moment, t.intl) })}
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <SmallButton disabled={busy} onClick={() => run(() => workspaceSession().share())}>{t('New link')}</SmallButton>
            <SmallButton danger disabled={busy} onClick={() => run(() => workspaceSession().unshare())}>{t('Stop sharing')}</SmallButton>
          </div>
          <p className="text-[11px] text-ink-3">{t('A new link or stopping sharing makes the current link stop working at once.')}</p>
        </>
      ) : (
        <SmallButton disabled={busy} onClick={() => run(() => workspaceSession().share())}>{busy ? t('Creating…') : t('Create link')}</SmallButton>
      )}
      <FormError message={error} />
    </DialogFrame>
  );
}
