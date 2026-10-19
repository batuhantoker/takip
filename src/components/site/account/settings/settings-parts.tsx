'use client';

import type { ComponentProps, ReactNode } from 'react';
import { authClient } from '@/components/site/account/auth-client';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { showAccountDialog } from '../account-dialog-state';
import { Notice, TextButton } from '../form-parts';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-line px-4 py-4 last:border-b-0">
      <h3 className="text-meta font-medium text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

export function Row({ icon, label, detail, children }: { icon?: ReactNode; label: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-ink-1">{label}</span>
        {detail && <span className="truncate text-small text-ink-3">{detail}</span>}
      </div>
      {children}
    </div>
  );
}

/** A small secondary (or danger) button, as the settings and workspace dialogs use it. */
export function SmallButton({ danger, ...props }: ComponentProps<'button'> & { danger?: boolean }) {
  return <Button size="sm" variant={danger ? 'danger' : 'secondary'} {...props} />;
}

/** Better Auth refuses some changes on a session signed in more than a day ago. */
export const needsFreshSignIn = (error: { code?: string } | null | undefined) =>
  error?.code === 'SESSION_NOT_FRESH' || error?.code === 'SESSION_EXPIRED';

export function SignInAgain() {
  const t = useT();
  const again = async () => {
    await authClient.signOut();
    showAccountDialog({ kind: 'sign-in', notice: t('Signed out. Sign in again, then reopen Account settings.') });
  };
  return (
    <Notice>
      {t('For your security, this needs a recent sign-in.')} <TextButton onClick={again}>{t('Sign in again')}</TextButton>
    </Notice>
  );
}
