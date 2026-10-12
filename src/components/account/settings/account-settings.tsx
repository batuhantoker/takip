'use client';

import { authClient } from '@/lib/auth-client';
import { showAccountDialog } from '../account-dialog-state';
import { Notice, TextButton } from '../form-parts';
import ApiKeysSection from './api-keys-section';
import DeleteAccountSection from './delete-account-section';
import DevicesSection from './devices-section';
import PlanSection from './plan-section';
import ProfileSection from './profile-section';
import SignInMethods from './sign-in-methods';
import TwoFactorSection from './two-factor-section';

export default function AccountSettings({ notice }: { notice?: string }) {
  const { data, isPending } = authClient.useSession();

  if (isPending) return <p className="p-4 text-[11px] text-[var(--text-muted)]">Loading…</p>;
  if (!data) {
    return (
      <div className="p-4">
        <Notice>
          {notice ?? 'You are signed out.'}{' '}
          <TextButton onClick={() => showAccountDialog({ kind: 'sign-in' })}>Sign in</TextButton>
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {notice && <div className="px-4 pt-3.5"><Notice>{notice}</Notice></div>}
      <PlanSection />
      <ProfileSection user={data.user} />
      <SignInMethods email={data.user.email} />
      <TwoFactorSection enabled={Boolean(data.user.twoFactorEnabled)} admin={data.user.role === 'admin'} />
      <DevicesSection currentId={data.session.id} />
      <ApiKeysSection />
      <DeleteAccountSection email={data.user.email} />
    </div>
  );
}
