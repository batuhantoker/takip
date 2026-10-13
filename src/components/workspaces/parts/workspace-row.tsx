'use client';

import { useState, type FormEvent } from 'react';
import { Link2 } from 'lucide-react';
import { timeAgo } from '@/lib/account/device-label';
import type { WorkspaceFailure, WorkspaceSummary } from '@/lib/workspaces/api';
import { workspaceSession } from '@/lib/workspaces/session';
import { FormError, INPUT } from '@/components/site/account/form-parts';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import { describeWorkspaceFailure } from '@/components/workspaces/messages';

type Mode = 'idle' | 'renaming' | 'deleting';

/** One workspace in Open: open it, rename it, or delete it. */
export default function WorkspaceRow({ workspace, isCurrent, onOpened }: { workspace: WorkspaceSummary; isCurrent: boolean; onOpened: () => void }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<WorkspaceFailure | null>, then?: () => void) => {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) return setError(describeWorkspaceFailure(failure));
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
          <input name="name" defaultValue={workspace.name} maxLength={80} required autoFocus aria-label="New name" className={`${INPUT} flex-1 min-w-0`} />
          <SmallButton onClick={() => setMode('idle')}>Cancel</SmallButton>
          <SmallButton type="submit" disabled={busy}>Rename</SmallButton>
        </form>
      ) : (
        <div className="flex items-center gap-2 min-h-8">
          <button type="button" disabled={busy || isCurrent} onClick={() => run(() => workspaceSession().open(workspace.id), onOpened)}
            className="flex flex-col min-w-0 flex-1 text-left disabled:cursor-default group">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-1 group-enabled:group-hover:text-ink-1 truncate">
              <span className="truncate">{workspace.name}</span>
              {workspace.shareSlug && <Link2 className="w-3 h-3 shrink-0 text-ink-3" aria-label="Shared" />}
            </span>
            <span className="text-[11px] text-ink-3">{isCurrent ? 'Open now · ' : ''}Saved {timeAgo(new Date(workspace.updatedAt))}</span>
          </button>
          {mode === 'idle' && (
            <>
              <SmallButton onClick={() => setMode('renaming')}>Rename</SmallButton>
              <SmallButton onClick={() => setMode('deleting')}>Delete…</SmallButton>
            </>
          )}
        </div>
      )}
      {mode === 'deleting' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[10rem] text-[13px] text-ink-1">
            Delete it{workspace.shareSlug ? '? Its share link stops working.' : '?'}
          </span>
          <SmallButton onClick={() => setMode('idle')}>Cancel</SmallButton>
          <SmallButton danger disabled={busy} onClick={() => run(() => workspaceSession().remove(workspace.id))}>Delete</SmallButton>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}
