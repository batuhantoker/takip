'use client';

import { LogIn } from 'lucide-react';
import { showAccountDialog } from '@/components/account/account-dialog-state';

/** Shown in place of a recon tool's error when the tool needs an account. */
export function SignInNotice() {
  return (
    <div className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 flex items-center justify-between gap-3">
      <span className="text-[11px] text-[var(--text-secondary)]">Sign in to use recon tools</span>
      <button
        type="button"
        onClick={() => showAccountDialog({ kind: 'sign-in' })}
        className="h-7 px-2.5 shrink-0 inline-flex items-center gap-1.5 rounded-md text-[11px] border border-white/10 text-[var(--text-primary)] hover:bg-white/[0.07] transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" aria-hidden />
        Sign in
      </button>
    </div>
  );
}
