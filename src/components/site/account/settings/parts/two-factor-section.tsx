'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '@/components/site/account/auth-client';
import { Field, FormError, Notice } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR } from '@/components/site/account/use-form-action';
import QrCode from './qr-code';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';

type Action = 'enable' | 'disable' | 'codes';
type Step =
  | { kind: 'idle'; message?: string }
  | { kind: 'password'; action: Action }
  | { kind: 'scan'; uri: string; backupCodes: string[] }
  | { kind: 'codes'; codes: string[] };

export default function TwoFactorSection({ enabled, admin }: { enabled: boolean; admin: boolean }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void authClient.listAccounts().then(({ data }) => {
      if (live) setHasPassword(Boolean(data?.some(a => a.providerId === 'credential')));
    });
    return () => {
      live = false;
    };
  }, []);

  const run = async (action: Action, password?: string) => {
    setBusy(true);
    setError(null);
    // Accounts without a password may skip it (allowPasswordless on the server).
    const credentials = password ? { password } : ({} as { password: string });
    if (action === 'enable') {
      const { data, error } = await authClient.twoFactor.enable({ ...credentials, method: 'totp' });
      if (data?.method === 'totp') setStep({ kind: 'scan', uri: data.totpURI, backupCodes: data.backupCodes });
      else setError(error?.message ?? FALLBACK_ERROR);
    } else if (action === 'disable') {
      const { error } = await authClient.twoFactor.disable(credentials);
      if (error) setError(error.message ?? FALLBACK_ERROR);
      else setStep({ kind: 'idle', message: 'Two-factor authentication is off.' });
    } else {
      const { data, error } = await authClient.twoFactor.generateBackupCodes(credentials);
      if (data) setStep({ kind: 'codes', codes: data.backupCodes });
      else setError(error?.message ?? FALLBACK_ERROR);
    }
    setBusy(false);
  };

  const start = (action: Action) => (hasPassword ? setStep({ kind: 'password', action }) : run(action));

  const confirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code')).trim();
    setBusy(true);
    setError(null);
    // Turning it on replaces this session with a new one; the session hook refreshes on its own.
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error) return setError(error.code === 'INVALID_CODE' ? "That code didn't work. Check the time on your phone and try again." : error.message ?? FALLBACK_ERROR);
    setStep({ kind: 'idle', message: 'Two-factor authentication is on.' });
  };

  return (
    <Section title="Two-factor authentication">
      <p className="text-small text-ink-2">
        Asks for a code from an authenticator app after your password. Signing in with Google, GitHub or another provider relies on
        that provider&apos;s own two-factor instead.{admin && !enabled && ' Required for the admin console.'}
      </p>
      {step.kind === 'idle' && step.message && <Notice>{step.message}</Notice>}
      <FormError message={error} />

      {step.kind === 'idle' && (
        <Row label="Authenticator app" detail={enabled ? 'On' : 'Off'}>
          {enabled ? (
            <>
              <SmallButton disabled={busy || hasPassword === null} onClick={() => start('codes')}>New backup codes</SmallButton>
              <SmallButton disabled={busy || hasPassword === null} onClick={() => start('disable')}>Turn off</SmallButton>
            </>
          ) : (
            <SmallButton disabled={busy || hasPassword === null} onClick={() => start('enable')}>Turn on</SmallButton>
          )}
        </Row>
      )}

      {step.kind === 'password' && (
        <form
          onSubmit={e => {
            e.preventDefault();
            void run(step.action, String(new FormData(e.currentTarget).get('password')));
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <Field label="Confirm your password" name="password" type="password" autoComplete="current-password" autoFocus />
          </div>
          <SmallButton onClick={() => setStep({ kind: 'idle' })}>Cancel</SmallButton>
          <SmallButton type="submit" disabled={busy}>Continue</SmallButton>
        </form>
      )}

      {step.kind === 'scan' && (
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink-1">1. Scan this with your authenticator app (1Password, Google Authenticator, Authy…):</p>
          <div className="self-center p-1 bg-white"><QrCode text={step.uri} /></div>
          <p className="text-meta text-ink-3 break-all">
            Can&apos;t scan? Enter this key: <span className="font-mono text-ink-1">{new URL(step.uri).searchParams.get('secret')}</span>
          </p>
          <p className="text-body text-ink-1">2. Save these backup codes somewhere safe. Each signs you in once if you lose your phone:</p>
          <BackupCodes codes={step.backupCodes} />
          <form onSubmit={confirm} className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="3. Enter the 6-digit code it shows" name="code" inputMode="numeric" pattern="\d{6}" autoComplete="one-time-code" />
            </div>
            <SmallButton onClick={() => setStep({ kind: 'idle' })}>Cancel</SmallButton>
            <SmallButton type="submit" disabled={busy}>Turn on</SmallButton>
          </form>
        </div>
      )}

      {step.kind === 'codes' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-body text-ink-1">Your new backup codes. The old ones no longer work.</p>
          <BackupCodes codes={step.codes} />
          <SmallButton className="self-start" onClick={() => setStep({ kind: 'idle' })}>I&apos;ve saved them</SmallButton>
        </div>
      )}
    </Section>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 p-2.5 rounded-card border border-line bg-surface-0 font-mono text-body text-ink-1">
        {codes.map(code => <li key={code}>{code}</li>)}
      </ul>
      <SmallButton
        className="self-start"
        onClick={() => void navigator.clipboard.writeText(codes.join('\n')).then(() => setCopied(true))}
      >
        {copied ? 'Copied' : 'Copy codes'}
      </SmallButton>
    </div>
  );
}
