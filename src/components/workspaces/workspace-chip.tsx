'use client';

import { useId, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Bookmark, ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { showAccountDialog } from '@/components/account/account-dialog-state';
import { useDismiss } from '@/components/ui/use-dismiss';
import { SIGN_IN_TO_SAVE } from './messages';
import { useWorkspace } from './use-workspace';
import WorkspaceMenu from './workspace-menu';

const CHIP =
  'pointer-events-auto glass-panel tool-glass h-9 flex items-center gap-2 px-3 text-[11px] text-[var(--text-primary)] hover:text-[var(--gold-light)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 disabled:opacity-40';

const MARKS = {
  saved: { label: 'Saved', dot: 'bg-[var(--alert-green)]/70' },
  saving: { label: 'Saving…', dot: 'bg-[var(--gold-primary)] animate-pulse' },
  unsaved: { label: 'Unsaved', dot: 'bg-[var(--gold-primary)]' },
  offline: { label: 'Offline', dot: 'bg-[var(--alert-red)]' },
  'read-only': { label: 'Read-only', dot: 'bg-[var(--text-secondary)]' },
  'not-saved': { label: 'Not saved', dot: 'border border-[var(--text-muted)]' },
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
        <Bookmark className="w-3.5 h-3.5 shrink-0 text-[var(--gold-primary)]" aria-hidden />
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
        <Bookmark className="w-3.5 h-3.5 shrink-0 text-[var(--gold-primary)]" aria-hidden />
        <span className="truncate max-w-[9rem] sm:max-w-[14rem]">{name}</span>
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${mark.dot}`} />
        <span aria-hidden className="hidden sm:inline text-[10px] text-[var(--text-muted)] whitespace-nowrap">{mark.label}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <AnimatePresence>
        {open && <WorkspaceMenu id={menuId} align={align} signedIn={Boolean(data)} onDone={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
