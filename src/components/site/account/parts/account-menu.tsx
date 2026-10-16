'use client';

import type { ComponentProps } from 'react';
import { EyeOff, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useAccess } from '@/components/site/account/use-access';
import { authClient } from '@/components/site/account/auth-client';
import { stopImpersonating } from '@/lib/platform/account/impersonation';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { AnchorBox, RailButton } from '@/components/shell/sidebar/rail-button';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';

const initial = (s: string) => s.trim().charAt(0).toUpperCase() || '?';

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-meta font-semibold text-ink-1 ring-1 ring-line-strong">
      {initial(name)}
    </span>
  );
}

/** The phone's trigger: just the avatar. */
function AvatarTrigger({ name, ...props }: Omit<ComponentProps<'button'>, 'children'> & { name: string }) {
  return (
    <AnchorBox className="inline-flex">
      <button type="button" aria-label={`Account: ${name}`} {...props}
        className={cx('flex size-8 items-center justify-center rounded-control hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
        <Avatar name={name} />
      </button>
    </AnchorBox>
  );
}

/** `impersonating`: an admin is viewing as this user; signing out would leave them signed out of their own account too. */
export default function AccountMenu({ user, impersonating = false, rail = false }: {
  user: { name: string; email: string; role?: string | null }; impersonating?: boolean; compact: boolean; rail?: boolean;
}) {
  const access = useAccess();
  const name = user.name || user.email;
  const trigger = rail
    ? <RailButton glyph={<Avatar name={name} />} label={name.split(/[\s@]/)[0]} hint={user.email} />
    : <AvatarTrigger name={name} />;

  return (
    <Popover role="menu" label="Account" placement={rail ? 'right' : 'bottom'} align="end" className="w-64 p-1" trigger={trigger}>
      {close => (
        <>
          <div className="flex items-center gap-3 px-2 pt-2 pb-2.5">
            <Avatar name={name} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body font-medium text-ink-1">{user.name || 'Your account'}</span>
              <span className="truncate text-small text-ink-3">{user.email}</span>
            </div>
          </div>
          {access && <p className="-mt-1 px-2 pb-2 pl-[46px] text-meta text-ink-3">{access.plan.name} plan</p>}
          <MenuDivider />
          <MenuItem icon={Settings} onSelect={() => { close(); showAccountDialog({ kind: 'settings' }); }}>Account settings</MenuItem>
          {user.role === 'admin' && <MenuItem icon={ShieldCheck} href="/admin" onSelect={close}>Admin console</MenuItem>}
          <MenuDivider />
          {impersonating
            ? <MenuItem icon={EyeOff} danger onSelect={() => { close(); void stopImpersonating(); }}>Stop viewing as {name}</MenuItem>
            : <MenuItem icon={LogOut} onSelect={() => { close(); void authClient.signOut(); }}>Sign out</MenuItem>}
        </>
      )}
    </Popover>
  );
}
