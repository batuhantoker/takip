'use client';

import { UserRound } from 'lucide-react';
import { authClient } from './auth-client';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { RailButton } from '@/components/shell/sidebar/rail-button';
import { showAccountDialog } from './account-dialog-state';
import AccountMenu from '@/components/site/account/parts/account-menu';

/** `rail` is the sidebar's version: a glyph over a label, its menu opening beside the sidebar. */
export default function AccountButton({ compact = false, rail = false }: { compact?: boolean; rail?: boolean }) {
  const t = useT();
  const { data, isPending } = authClient.useSession();
  if (data) return <AccountMenu user={data.user} impersonating={Boolean(data.session.impersonatedBy)} compact={compact} rail={rail} />;

  const signIn = () => { if (!isPending) showAccountDialog({ kind: 'sign-in' }); };
  if (rail) {
    return <RailButton glyph={<UserRound className="size-[18px]" strokeWidth={1.75} />} label={t('Sign in')} hint={t('Sign in to save areas, keys and workspaces')} onClick={signIn} />;
  }
  return <Button variant={compact ? 'ghost' : 'secondary'} size="sm" disabled={isPending} onClick={signIn}>{t('Sign in')}</Button>;
}
