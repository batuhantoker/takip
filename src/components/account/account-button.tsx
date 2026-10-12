'use client';

import { authClient } from '@/lib/auth-client';
import { UserRound } from 'lucide-react';
import { MENU_TRIGGER, RAIL_TRIGGER } from '@/components/ui/menu-styles';
import { showAccountDialog } from './account-dialog-state';
import AccountMenu from './account-menu';

/** `rail` is the sidebar's version: an icon over a label, its menu opening beside the sidebar. */
export default function AccountButton({ compact = false, rail = false }: { compact?: boolean; rail?: boolean }) {
  const { data, isPending } = authClient.useSession();
  if (data) return <AccountMenu user={data.user} impersonating={Boolean(data.session.impersonatedBy)} compact={compact} rail={rail} />;

  if (rail) {
    return (
      <button type="button" disabled={isPending} onClick={() => showAccountDialog({ kind: 'sign-in' })}
        className={`${RAIL_TRIGGER} disabled:opacity-40`}>
        <UserRound className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden />
        <span className="text-[10.5px] leading-none">Sign in</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => showAccountDialog({ kind: 'sign-in' })}
      className={`${MENU_TRIGGER} ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} pointer-events-auto disabled:opacity-40`}
    >
      <span className="text-[var(--gold-primary)] font-bold">SIGN IN</span>
    </button>
  );
}
