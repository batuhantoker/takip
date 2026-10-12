'use client';

import { useState } from 'react';
import { fetchAccountExport } from '@/lib/account-export';
import { downloadFile } from '@/lib/aoi-export';
import { FormError } from '../form-parts';
import { FALLBACK_ERROR } from '../use-form-action';
import { Section, SignInAgain, SmallButton } from './settings-parts';

const FAILURES: Record<string, string> = {
  sign_in_required: 'You were signed out. Sign in again to download your data.',
  network: "Couldn't reach the server. Check your connection and try again.",
};

export default function YourDataSection() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setFailure(null);
    const result = await fetchAccountExport();
    setBusy(false);
    if (result.failure !== undefined) return setFailure(result.failure);
    downloadFile(result.filename, result.text, 'application/json');
  };

  return (
    <Section title="Your data">
      <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
        A copy of what we keep about your account, as a JSON file: profile, sign-in methods, devices, plan, API keys, usage and account history.
      </p>
      {failure === 'session_not_fresh' ? <SignInAgain /> : <FormError message={failure && (FAILURES[failure] ?? FALLBACK_ERROR)} />}
      <SmallButton className="self-start" disabled={busy} onClick={download}>
        {busy ? 'Preparing…' : 'Download my data'}
      </SmallButton>
    </Section>
  );
}
