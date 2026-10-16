'use client';

import { useEffect, useState } from 'react';
import { useAccess } from '@/components/site/account/use-access';
import { isExpired, listApiKeys, type ApiKey, type NewApiKey } from '@/lib/platform/account/api-keys';
import { FormError, Notice } from '@/components/site/account/form-parts';
import { describeKeyFailure, keyCount } from './api-key-messages';
import ApiKeyRow from './api-key-row';
import NewApiKeyForm from './new-api-key-form';
import NewApiKeyNotice from './new-api-key-notice';
import { Section, SmallButton } from '@/components/site/account/settings/settings-parts';

type Step = { kind: 'idle' } | { kind: 'form' } | { kind: 'created'; key: NewApiKey };

const MUTED = 'text-small text-ink-3';

export default function ApiKeysSection() {
  const access = useAccess();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });

  const show = ({ data, failure }: Awaited<ReturnType<typeof listApiKeys>>) => {
    setError(failure ? describeKeyFailure(failure) : null);
    if (data) setKeys(data.keys);
  };

  useEffect(() => {
    let live = true;
    void listApiKeys().then(result => {
      if (live) show(result);
    });
    return () => {
      live = false;
    };
  }, []);

  const reload = async () => show(await listApiKeys());

  // Keys a plan can hold: 0 when it has no API at all.
  const allowed = access && (access.entitlements['api.enabled'] ? access.entitlements['api.keys.max'] : 0);
  const active = keys?.filter(key => !isExpired(key)).length ?? 0;

  return (
    <Section title="API keys">
      <p className={`${MUTED} leading-relaxed`}>
        Let your own scripts and tools use the API. Send a key in an <span className="font-mono">Authorization: Bearer</span> header, never in a
        link.{' '}
        <a href="/api/v1/docs" target="_blank" rel="noreferrer" className="text-accent hover:underline">API reference</a>
      </p>
      {allowed === 0 && <Notice>Your plan doesn&apos;t include API access.</Notice>}
      <FormError message={error} />
      {step.kind === 'created' && <NewApiKeyNotice created={step.key} onDone={() => setStep({ kind: 'idle' })} />}

      {keys === null || allowed === null ? (
        !error && <p className={MUTED}>Loading…</p>
      ) : keys.length ? (
        keys.map(key => <ApiKeyRow key={key.id} apiKey={key} onRevoked={reload} />)
      ) : (
        allowed > 0 && <p className={MUTED}>No keys yet.</p>
      )}

      {keys !== null && allowed !== null && allowed > 0 && step.kind !== 'created' && (
        active >= allowed ? (
          <p className={MUTED}>Your plan allows {keyCount(allowed)}. Revoke one to create another.</p>
        ) : step.kind === 'form' ? (
          <NewApiKeyForm
            onCancel={() => setStep({ kind: 'idle' })}
            onCreated={key => {
              setStep({ kind: 'created', key });
              void reload();
            }}
          />
        ) : (
          <SmallButton className="self-start" onClick={() => setStep({ kind: 'form' })}>Create key…</SmallButton>
        )
      )}
    </Section>
  );
}
