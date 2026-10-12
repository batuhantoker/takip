'use client';

import { authClient } from '@/lib/auth-client';
import { MENU_TRIGGER } from '@/components/ui/menu-styles';
import { showAccountDialog } from './account-dialog-state';
import AccountMenu from './account-menu';

export default function AccountButton({ compact = false }: { compact?: boolean }) {
  const { data, isPending } = authClient.useSession();
  if (data) return <AccountMenu user={data.user} compact={compact} />;

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
