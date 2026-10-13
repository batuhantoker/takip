'use client';

import { useState } from 'react';
import { DELETED_CALLBACK } from '@/lib/account/links';
import { authClient } from '@/lib/account/auth-client';
import { billingPortalUrl } from '@/lib/account/billing-portal';
import { FormError, Notice } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR } from '@/components/site/account/use-form-action';
import { Section, SmallButton } from '@/components/site/account/settings/settings-parts';

// The api's refusal code (apps/api/src/billing/deletion-guard.ts).
const SUBSCRIPTION_ACTIVE = 'subscription_active';
const PORTAL_FAILED = "Billing didn't open. Try again.";

type Refusal = { message: string; billingPortal: boolean };

export default function DeleteAccountSection({ email }: { email: string }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendLink = async () => {
    setBusy(true);
    setError(null);
    const { error } = await authClient.deleteUser({ callbackURL: DELETED_CALLBACK });
    setBusy(false);
    if (error?.code === SUBSCRIPTION_ACTIVE) {
      return setRefusal({ message: error.message ?? FALLBACK_ERROR, billingPortal: (error as { billing_portal?: unknown }).billing_portal === true });
    }
    if (error) return setError(error.message ?? FALLBACK_ERROR);
    setStep('sent');
  };

  const manageBilling = async () => {
    setBusy(true);
    setError(null);
    const result = await billingPortalUrl();
    if (result.failure !== undefined) {
      setBusy(false);
      return setError(PORTAL_FAILED);
    }
    window.location.assign(result.url);
  };

  return (
    <Section title="Delete account">
      {step === 'sent' ? (
        <Notice>We sent a link to {email}. Open it in this browser within an hour to delete your account.</Notice>
      ) : (
        <>
          <p className="text-small text-ink-2">
            Deletes your account with its sign-in methods, devices and API keys. Usage counts and account history stay, without your email
            address. This can&apos;t be undone.
          </p>
          <FormError message={error} />
          {refusal ? (
            <>
              <Notice>{refusal.message}</Notice>
              {refusal.billingPortal && (
                <SmallButton disabled={busy} onClick={manageBilling} className="self-start">Manage billing</SmallButton>
              )}
            </>
          ) : step === 'idle' ? (
            <SmallButton danger onClick={() => setStep('confirm')} className="self-start">Delete account…</SmallButton>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-body text-ink-1">We&apos;ll email you a link to confirm.</span>
              <SmallButton onClick={() => setStep('idle')}>Cancel</SmallButton>
              <SmallButton danger disabled={busy} onClick={sendLink}>Send link</SmallButton>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
