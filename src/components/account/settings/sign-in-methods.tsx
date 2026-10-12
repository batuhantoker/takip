'use client';

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { RESET_CALLBACK, SETTINGS_CALLBACK } from '@/lib/account-links';
import { authClient } from '@/lib/auth-client';
import { Notice } from '../form-parts';
import { PROVIDER_ICONS } from '../provider-icons';
import { PROVIDER_IDS, PROVIDER_LABELS, canConnect, loadProviders, type ProviderId } from '../providers';
import { FALLBACK_ERROR } from '../use-form-action';
import ChangePasswordForm from './change-password-form';
import { Row, Section, SignInAgain, SmallButton, needsFreshSignIn } from './settings-parts';

type Account = { id: string; providerId: string };

export default function SignInMethods({ email }: { email: string }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [configured, setConfigured] = useState<ProviderId[]>([]);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const reload = async () => {
    const { data } = await authClient.listAccounts();
    setAccounts(data ?? []);
  };

  useEffect(() => {
    let live = true;
    void Promise.all([authClient.listAccounts(), loadProviders()]).then(([{ data }, providers]) => {
      if (!live) return;
      setAccounts(data ?? []);
      setConfigured(providers);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!accounts) return <Section title="Sign-in methods"><p className="text-[11px] text-[var(--text-muted)]">Loading…</p></Section>;

  const accountFor = (id: ProviderId) => accounts.find(a => a.providerId === id);
  const hasPassword = accounts.some(a => a.providerId === 'credential');
  const onlyOne = accounts.length === 1;
  const rows = PROVIDER_IDS.filter(id => accountFor(id) || (configured.includes(id) && canConnect(id)));

  const run = async (action: () => Promise<{ error: { code?: string; message?: string } | null }>, done?: string) => {
    setPending(true);
    setMessage(null);
    const { error } = await action();
    setPending(false);
    if (needsFreshSignIn(error)) return setStale(true);
    if (error) return setMessage(error.message ?? FALLBACK_ERROR);
    if (done) setMessage(done);
    await reload();
  };

  return (
    <Section title="Sign-in methods">
      {stale && <SignInAgain />}
      {message && <Notice>{message}</Notice>}

      <Row icon={<KeyRound className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />} label="Password" detail={hasPassword ? 'Set' : 'Not set'}>
        {hasPassword ? (
          <SmallButton onClick={() => setChangingPassword(v => !v)}>{changingPassword ? 'Cancel' : 'Change'}</SmallButton>
        ) : (
          <SmallButton
            disabled={pending}
            onClick={() => run(() => authClient.requestPasswordReset({ email, redirectTo: RESET_CALLBACK }), `We sent a link to ${email} to set a password.`)}
          >
            Set one
          </SmallButton>
        )}
      </Row>
      {changingPassword && (
        <ChangePasswordForm
          onDone={() => {
            setChangingPassword(false);
            setMessage('Password changed.');
          }}
        />
      )}

      {rows.map(id => {
        const account = accountFor(id);
        return (
          <Row key={id} icon={PROVIDER_ICONS[id]} label={PROVIDER_LABELS[id]} detail={account ? 'Connected' : undefined}>
            {account ? (
              <SmallButton
                disabled={pending || onlyOne}
                title={onlyOne ? "It's your only way to sign in" : undefined}
                onClick={() => run(() => authClient.unlinkAccount({ accountId: account.id }))}
              >
                Disconnect
              </SmallButton>
            ) : (
              // On success the browser leaves for the provider and comes back to these settings.
              <SmallButton
                disabled={pending}
                onClick={() => run(() => authClient.linkSocial({ provider: id, callbackURL: SETTINGS_CALLBACK, errorCallbackURL: SETTINGS_CALLBACK }))}
              >
                Connect
              </SmallButton>
            )}
          </Row>
        );
      })}
    </Section>
  );
}
