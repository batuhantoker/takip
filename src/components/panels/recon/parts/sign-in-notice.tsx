'use client';

import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';

const signIn = (t: Translate) => showAccountDialog({ kind: 'sign-in', notice: t('Sign in to run Recon lookups.') });

/** Shown where an answer would be when the lookup needs an account. */
export function SignInNotice({ className }: { className?: string }) {
  const t = useT();
  return (
    <div className={cx('flex items-center gap-3 rounded-card border border-line bg-surface-2 py-2 pr-2 pl-3', className)}>
      <p className="min-w-0 flex-1 text-small text-ink-2">{t('Lookups run on our servers, so they need an account.')}</p>
      <Button size="sm" icon={LogIn} onClick={() => signIn(t)}>{t('Sign in')}</Button>
    </div>
  );
}

/** Recon's footer while signed out, so the account rule is known before anything is typed. */
export function SignInFooter() {
  const t = useT();
  return (
    <>
      <span className="min-w-0 flex-1">{t('Most lookups need an account')}</span>
      <Button variant="ghost" size="sm" icon={LogIn} onClick={() => signIn(t)} className="-mr-2">{t('Sign in')}</Button>
    </>
  );
}
