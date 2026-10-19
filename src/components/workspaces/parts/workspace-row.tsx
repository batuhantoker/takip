'use client';

import { useState, type FormEvent } from 'react';
import { Link2 } from 'lucide-react';
import { timeAgo } from '@/lib/platform/account/device-label';
import type { WorkspaceFailure, WorkspaceSummary } from '@/lib/platform/workspaces/api';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { FormError, INPUT } from '@/components/site/account/form-parts';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import { describeWorkspaceFailure } from '@/components/workspaces/messages';
import { useT } from '@/components/ui/use-t';

type Mode = 'idle' | 'renaming' | 'deleting';

/** One workspace in Open: open it, rename it, or delete it. */
export default function WorkspaceRow({ workspace, isCurrent, onOpened }: { workspace: WorkspaceSummary; isCurrent: boolean; onOpened: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<WorkspaceFailure | null>, then?: () => void) => {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) return setError(describeWorkspaceFailure(failure, t));
    setMode('idle');
    then?.();
  };

  const rename = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get('name')).trim();
    void run(() => workspaceSession().rename(workspace.id, name));
  };

  return (
    <div className="flex flex-col gap-1.5 py-1.5 border-b border-line last:border-b-0">
      {mode === 'renaming' ? (
        <form onSubmit={rename} className="flex items-center gap-2">
          <input name="name" defaultValue={workspace.name} maxLength={80} required autoFocus aria-label={t('New name')} className={`${INPUT} flex-1 min-w-0`} />
          <SmallButton onClick={() => setMode('idle')}>{t('Cancel')}</SmallButton>
          <SmallButton type="submit" disabled={busy}>{t('Rename')}</SmallButton>
        </form>
      ) : (
        <div className="flex items-center gap-2 min-h-8">
          <button type="button" disabled={busy || isCurrent} onClick={() => run(() => workspaceSession().open(workspace.id), onOpened)}
            className="flex flex-col min-w-0 flex-1 text-left disabled:cursor-default group">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-1 group-enabled:group-hover:text-ink-1 truncate">
              <span className="truncate">{workspace.name}</span>
              {workspace.shareSlug && <Link2 className="w-3 h-3 shrink-0 text-ink-3" aria-label={t('Shared')} />}
            </span>
            <span className="text-[11px] text-ink-3">{isCurrent ? `${t('Open now')} · ` : ''}{t('Saved {when}', { when: timeAgo(new Date(workspace.updatedAt), undefined, t) })}</span>
          </button>
          {mode === 'idle' && (
            <>
              <SmallButton onClick={() => setMode('renaming')}>{t('Rename')}</SmallButton>
              <SmallButton onClick={() => setMode('deleting')}>{t('Delete…')}</SmallButton>
            </>
          )}
        </div>
      )}
      {mode === 'deleting' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[10rem] text-[13px] text-ink-1">
            {workspace.shareSlug ? t('Delete it? Its share link stops working.') : t('Delete it?')}
          </span>
          <SmallButton onClick={() => setMode('idle')}>{t('Cancel')}</SmallButton>
          <SmallButton danger disabled={busy} onClick={() => run(() => workspaceSession().remove(workspace.id))}>{t('Delete')}</SmallButton>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}
