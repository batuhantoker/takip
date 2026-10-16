'use client';

import { authClient } from '@/components/site/account/auth-client';
import { showAccountDialog } from '../account-dialog-state';
import { Notice, TextButton } from '../form-parts';
import ApiKeysSection from '@/components/site/account/settings/api-keys/api-keys-section';
import DeleteAccountSection from '@/components/site/account/settings/parts/delete-account-section';
import DevicesSection from '@/components/site/account/settings/parts/devices-section';
import PlanSection from '@/components/site/account/settings/parts/plan-section';
import ProfileSection from '@/components/site/account/settings/parts/profile-section';
import SignInMethods from '@/components/site/account/settings/parts/sign-in-methods';
import TwoFactorSection from '@/components/site/account/settings/parts/two-factor-section';
import YourDataSection from '@/components/site/account/settings/parts/your-data-section';

export default function AccountSettings({ notice }: { notice?: string }) {
  const { data, isPending } = authClient.useSession();

  if (isPending) return <p className="p-4 text-small text-ink-3">Loading…</p>;
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
      <YourDataSection />
      <DeleteAccountSection email={data.user.email} />
    </div>
  );
}
