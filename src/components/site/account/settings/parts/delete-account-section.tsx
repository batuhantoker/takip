'use client';

import { useState } from 'react';
import { DELETED_CALLBACK } from '@/lib/platform/account/links';
import { authClient } from '@/components/site/account/auth-client';
import { billingPortalUrl } from '@/lib/platform/account/billing-portal';
import { FormError, Notice } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR } from '@/components/site/account/use-form-action';
import { Section, SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';

// The api's refusal code (apps/api/src/billing/deletion-guard.ts).
const SUBSCRIPTION_ACTIVE = 'subscription_active';

type Refusal = { message: string; billingPortal: boolean };

export default function DeleteAccountSection({ email }: { email: string }) {
  const t = useT();
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
      return setRefusal({ message: error.message ?? t(FALLBACK_ERROR), billingPortal: (error as { billing_portal?: unknown }).billing_portal === true });
    }
    if (error) return setError(error.message ?? t(FALLBACK_ERROR));
    setStep('sent');
  };

  const manageBilling = async () => {
    setBusy(true);
    setError(null);
    const result = await billingPortalUrl();
    if (result.failure !== undefined) {
      setBusy(false);
      return setError(t("Billing didn't open. Try again."));
    }
    window.location.assign(result.url);
  };

  return (
    <Section title={t('Delete account')}>
      {step === 'sent' ? (
        <Notice>{t('We sent a link to {email}. Open it in this browser within an hour to delete your account.', { email })}</Notice>
      ) : (
        <>
          <p className="text-small text-ink-2">
            {t("Deletes your account with its sign-in methods, devices and API keys. Usage counts and account history stay, without your email address. This can't be undone.")}
          </p>
          <FormError message={error} />
          {refusal ? (
            <>
              <Notice>{refusal.message}</Notice>
              {refusal.billingPortal && (
                <SmallButton disabled={busy} onClick={manageBilling} className="self-start">{t('Manage billing')}</SmallButton>
              )}
            </>
          ) : step === 'idle' ? (
            <SmallButton danger onClick={() => setStep('confirm')} className="self-start">{t('Delete account…')}</SmallButton>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-body text-ink-1">{t("We'll email you a link to confirm.")}</span>
              <SmallButton onClick={() => setStep('idle')}>{t('Cancel')}</SmallButton>
              <SmallButton danger disabled={busy} onClick={sendLink}>{t('Send link')}</SmallButton>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
