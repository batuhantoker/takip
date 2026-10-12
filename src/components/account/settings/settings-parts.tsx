'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import { showAccountDialog } from '../account-dialog-state';
import { Notice, TextButton } from '../form-parts';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 px-4 py-3.5 border-b border-[var(--border-primary)] last:border-b-0">
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</h3>
      {children}
    </section>
  );
}

export function Row({ icon, label, detail, children }: { icon?: ReactNode; label: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 min-h-8">
      {icon}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] text-[var(--text-primary)] truncate">{label}</span>
        {detail && <span className="text-[10px] text-[var(--text-muted)] truncate">{detail}</span>}
      </div>
      {children}
    </div>
  );
}

export function SmallButton({ danger, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  const tone = danger
    ? 'border-[var(--alert-red)]/40 text-[var(--alert-red)] hover:bg-[var(--alert-red)]/10'
    : 'border-white/10 text-[var(--text-primary)] hover:bg-white/[0.07]';
  return <button type="button" {...props} className={`h-8 px-2.5 shrink-0 text-[11px] border transition-colors disabled:opacity-40 ${tone} ${className}`} />;
}

/** Better Auth refuses some changes on a session signed in more than a day ago. */
export const needsFreshSignIn = (error: { code?: string } | null | undefined) =>
  error?.code === 'SESSION_NOT_FRESH' || error?.code === 'SESSION_EXPIRED';

export function SignInAgain() {
  const again = async () => {
    await authClient.signOut();
    showAccountDialog({ kind: 'sign-in', notice: 'Signed out. Sign in again, then reopen Account settings.' });
  };
  return (
    <Notice>
      For your security, this needs a recent sign-in. <TextButton onClick={again}>Sign in again</TextButton>
    </Notice>
  );
}
