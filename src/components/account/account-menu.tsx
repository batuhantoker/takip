'use client';

import { useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useAccess } from '@/lib/access';
import { authClient } from '@/lib/auth-client';
import { useDismiss } from '@/components/ui/use-dismiss';
import { MENU_ITEM, MENU_PANEL, MENU_TRIGGER } from '@/components/ui/menu-styles';
import { showAccountDialog } from './account-dialog-state';

export default function AccountMenu({ user, compact }: { user: { name: string; email: string; role?: string | null }; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const access = useAccess();
  useDismiss(open, () => setOpen(false), rootRef, buttonRef);

  const signOut = async () => {
    setOpen(false);
    await authClient.signOut();
  };

  return (
    <div ref={rootRef} className="relative pointer-events-auto">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={user.email}
        className={`${MENU_TRIGGER} ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
      >
        <span className="text-[var(--gold-primary)] font-bold max-w-[10rem] truncate">{(user.name || user.email).toUpperCase()}</span>
        <ChevronDown className={`w-2.5 h-2.5 text-[var(--gold-primary)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={MENU_PANEL}
          >
            <div className="px-2.5 py-2 flex flex-col min-w-0">
              <span className="text-[11px] text-[var(--text-primary)] truncate">{user.name}</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] truncate">{user.email}</span>
              {access && <span className="mt-1 text-[10px] text-[var(--gold-primary)]">{access.plan.name} plan</span>}
            </div>
            <div className="my-1 h-px bg-white/5" />
            <button
              type="button"
              role="menuitem"
              className={MENU_ITEM}
              onClick={() => {
                setOpen(false);
                showAccountDialog({ kind: 'settings' });
              }}
            >
              <Settings className="w-3.5 h-3.5 shrink-0 text-[var(--gold-primary)]" aria-hidden />
              <span className="text-[11px] text-[var(--text-primary)]">Account settings</span>
            </button>
            {user.role === 'admin' && (
              <a role="menuitem" href="/admin" className={MENU_ITEM}>
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[var(--gold-primary)]" aria-hidden />
                <span className="text-[11px] text-[var(--text-primary)]">Admin console</span>
              </a>
            )}
            <button type="button" role="menuitem" className={MENU_ITEM} onClick={signOut}>
              <LogOut className="w-3.5 h-3.5 shrink-0 text-[var(--gold-primary)]" aria-hidden />
              <span className="text-[11px] text-[var(--text-primary)]">Sign out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
