'use client';

import { useState } from 'react';
import { DELETED_CALLBACK } from '@/lib/account-links';
import { authClient } from '@/lib/auth-client';
import { FormError, Notice } from '../form-parts';
import { FALLBACK_ERROR } from '../use-form-action';
import { Section, SmallButton } from './settings-parts';

export default function DeleteAccountSection({ email }: { email: string }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendLink = async () => {
    setBusy(true);
    setError(null);
    const { error } = await authClient.deleteUser({ callbackURL: DELETED_CALLBACK });
    setBusy(false);
    if (error) return setError(error.message ?? FALLBACK_ERROR);
    setStep('sent');
  };

  return (
    <Section title="Delete account">
      {step === 'sent' ? (
        <Notice>We sent a link to {email}. Open it in this browser within an hour to delete your account.</Notice>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Deletes your account, its sign-in methods and every signed-in device. This can&apos;t be undone.
          </p>
          <FormError message={error} />
          {step === 'idle' ? (
            <SmallButton danger onClick={() => setStep('confirm')} className="self-start">Delete account…</SmallButton>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[11px] text-[var(--text-primary)]">We&apos;ll email you a link to confirm.</span>
              <SmallButton onClick={() => setStep('idle')}>Cancel</SmallButton>
              <SmallButton danger disabled={busy} onClick={sendLink}>Send link</SmallButton>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
