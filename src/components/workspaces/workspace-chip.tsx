'use client';

import { useId, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Bookmark, ChevronDown } from 'lucide-react';
import { authClient } from '@/components/site/account/auth-client';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { useDismiss } from '@/components/ui/use-dismiss';
import { SIGN_IN_TO_SAVE } from './messages';
import { useWorkspace } from './use-workspace';
import WorkspaceMenu from '@/components/workspaces/parts/workspace-menu';

const CHIP =
  'pointer-events-auto h-9 flex items-center gap-2 px-3 rounded-md border border-line bg-surface-1 shadow-float text-[13px] text-ink-1 hover:bg-surface-2 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40';

const MARKS = {
  saved: { label: 'Saved', dot: 'bg-green' },
  saving: { label: 'Saving…', dot: 'bg-ink-3 motion-safe:animate-pulse' },
  unsaved: { label: 'Unsaved', dot: 'bg-amber' },
  offline: { label: 'Offline', dot: 'bg-red' },
  'read-only': { label: 'Read-only', dot: 'bg-ink-2' },
  'not-saved': { label: 'Not saved', dot: 'border border-ink-3' },
} as const;

/**
 * The workspace name and its saved state, beside Search; its menu saves, shares and opens workspaces.
 * Signed out it reads "Save view" and asks to sign in. `align` is the edge the menu lines up with.
 */
export default function WorkspaceChip({ align = 'left' }: { align?: 'left' | 'right' }) {
  const { data, isPending } = authClient.useSession();
  const { current, status, shared } = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useDismiss(open, () => setOpen(false), rootRef, buttonRef);

  if (!data && !shared) {
    return (
      <button type="button" disabled={isPending} onClick={() => showAccountDialog({ kind: 'sign-in', notice: SIGN_IN_TO_SAVE })} className={CHIP}>
        <Bookmark className="w-3.5 h-3.5 shrink-0 text-ink-3" aria-hidden />
        <span>Save view</span>
      </button>
    );
  }

  const name = shared?.name ?? current?.name ?? 'Untitled view';
  const mark = MARKS[shared ? 'read-only' : current ? status : 'not-saved'];

  return (
    <div ref={rootRef} className="relative pointer-events-auto min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Workspace: ${name}, ${mark.label.toLowerCase()}`}
        title={`${name} · ${mark.label}`}
        className={`${CHIP} max-w-full`}
      >
        <Bookmark className="w-3.5 h-3.5 shrink-0 text-ink-3" aria-hidden />
        <span className="truncate max-w-[9rem] sm:max-w-[14rem]">{name}</span>
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${mark.dot}`} />
        <span aria-hidden className="hidden sm:inline text-[11px] text-ink-3 whitespace-nowrap">{mark.label}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <AnimatePresence>
        {open && <WorkspaceMenu id={menuId} align={align} signedIn={Boolean(data)} onDone={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
