'use client';

import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, CopyPlus, FolderOpen, HardDriveUpload, Link2, LogIn, Plus, Save } from 'lucide-react';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { MENU_ITEM } from '@/components/ui/menu-styles';
import { describeWorkspaceFailure, SIGN_IN_TO_SAVE } from '@/components/workspaces/messages';
import { useWorkspace } from '@/components/workspaces/use-workspace';
import { showWorkspaceDialog, type WorkspaceDialog } from '@/components/workspaces/workspace-dialog-state';

const PANEL = 'absolute top-full mt-2 z-[1000] w-64 max-w-[calc(100vw-24px)] rounded-float bg-surface-1 border border-line shadow-float p-1';
const RECENT = 5;

function Item({ icon, label, detail, onClick, disabled, expanded }: {
  icon: ReactNode; label: string; detail?: string; onClick: () => void; disabled?: boolean; expanded?: boolean;
}) {
  return (
    <button type="button" role="menuitem" aria-expanded={expanded} disabled={disabled} onClick={onClick} className={`${MENU_ITEM} disabled:opacity-40`}>
      <span className="w-3.5 h-3.5 shrink-0 text-ink-3 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden>{icon}</span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="text-[13px] text-ink-1 truncate">{label}</span>
        {detail && <span className="text-[11px] text-ink-3 truncate">{detail}</span>}
      </span>
      {expanded !== undefined && <ChevronRight className={`w-3 h-3 shrink-0 text-ink-3 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden />}
    </button>
  );
}

const Divider = () => <div className="my-1 h-px bg-line" />;

export default function WorkspaceMenu({ id, align, signedIn, onDone }: { id: string; align: 'left' | 'right'; signedIn: boolean; onDone: () => void }) {
  const { current, shared, list, problem, status } = useWorkspace();
  const [opening, setOpening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const session = workspaceSession();

  const dialog = (next: WorkspaceDialog) => {
    onDone();
    showWorkspaceDialog(next);
  };
  const act = async (action: () => Promise<{ error: string; status: number } | null>) => {
    const failure = await action();
    if (failure) setNote(describeWorkspaceFailure(failure));
    else onDone();
  };
  const toggleOpen = () => {
    if (!opening) void session.refreshList();
    setOpening(v => !v);
  };
  const importDevice = async () => {
    const result = await session.importDevice();
    setNote('id' in result ? `Saved as “${result.name}”. Find it under Open.` : describeWorkspaceFailure(result));
  };

  const others = (list ?? []).filter(w => w.id !== current?.id).slice(0, RECENT);
  const message = note ?? (problem && !shared ? describeWorkspaceFailure(problem) : null);

  return (
    <motion.div
      id={id}
      role="menu"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className={`${PANEL} ${align === 'left' ? 'left-0' : 'right-0'}`}
    >
      {message && <p role="status" className="px-2.5 py-2 text-[12px] leading-relaxed text-ink-1 border-l-2 border-line-strong m-1">{message}</p>}

      {shared ? (
        <>
          <div className="px-2.5 py-2 text-[11px] text-ink-3">Someone shared this view with you. Changes here aren&apos;t saved.</div>
          {signedIn
            ? <Item icon={<CopyPlus />} label="Save a copy…" onClick={() => dialog({ kind: 'name', mode: 'copy' })} />
            : <Item icon={<LogIn />} label="Sign in to save a copy" onClick={() => { onDone(); showAccountDialog({ kind: 'sign-in', notice: SIGN_IN_TO_SAVE }); }} />}
          <Item icon={<ArrowLeft />} label={current ? `Back to “${current.name}”` : 'Back to my view'} onClick={() => act(async () => { await session.leaveShared(); return null; })} />
        </>
      ) : (
        <>
          <Item icon={<Save />} label="Save" detail={current ? (status === 'saved' ? 'Saved; changes save as you go' : undefined) : 'Name this view to keep it'}
            onClick={() => (current ? act(session.save) : dialog({ kind: 'name', mode: 'save-as' }))} />
          <Item icon={<CopyPlus />} label="Save as…" onClick={() => dialog({ kind: 'name', mode: 'save-as' })} />
          <Item icon={<Link2 />} label="Share link…" detail={current?.shareSlug ? 'Shared by link' : undefined} onClick={() => dialog({ kind: 'share' })} />
        </>
      )}

      {signedIn && (
        <>
          <Item icon={<FolderOpen />} label="Open" expanded={opening} onClick={toggleOpen} />
          {opening && (
            <div role="group" aria-label="Workspaces" className="ml-6 border-l border-line">
              {list === null && <div className="px-2.5 py-1.5 text-[11px] text-ink-3">Loading…</div>}
              {others.map(w => (
                <button key={w.id} type="button" role="menuitem" onClick={() => act(() => session.open(w.id))} className={MENU_ITEM}>
                  <span className="text-[13px] text-ink-1 truncate">{w.name}</span>
                </button>
              ))}
              {(list?.length ?? 0) > 0 && (
                <button type="button" role="menuitem" onClick={() => dialog({ kind: 'open' })} className={MENU_ITEM}>
                  <span className="text-[11px] text-ink-2">All workspaces…</span>
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => dialog({ kind: 'name', mode: 'new' })} className={MENU_ITEM}>
                <Plus className="w-3 h-3 shrink-0 text-ink-3" aria-hidden />
                <span className="text-[13px] text-ink-1">New workspace…</span>
              </button>
            </div>
          )}
          {!shared && (
            <>
              <Divider />
              <Item icon={<HardDriveUpload />} label="Import from this device" detail="Layers, areas, places and watchlist saved here" onClick={importDevice} />
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
