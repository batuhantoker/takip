'use client';

import { useEffect, useState } from 'react';
import { useAccess } from '@/components/site/account/use-access';
import { isExpired, listApiKeys, type ApiKey, type ApiKeyFailure, type NewApiKey } from '@/lib/platform/account/api-keys';
import { FormError, Notice } from '@/components/site/account/form-parts';
import { describeKeyFailure, keyLimit } from './api-key-messages';
import ApiKeyRow from './api-key-row';
import NewApiKeyForm from './new-api-key-form';
import NewApiKeyNotice from './new-api-key-notice';
import { Section, SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';

type Step = { kind: 'idle' } | { kind: 'form' } | { kind: 'created'; key: NewApiKey };

const MUTED = 'text-small text-ink-3';

export default function ApiKeysSection() {
  const t = useT();
  const access = useAccess();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [failure, setFailure] = useState<ApiKeyFailure | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });

  const show = ({ data, failure: failed }: Awaited<ReturnType<typeof listApiKeys>>) => {
    setFailure(failed ?? null);
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
    <Section title={t('API keys')}>
      <p className={`${MUTED} leading-relaxed`}>
        {t.rich('Let your own scripts and tools use the API. Send a key in an {header} header, never in a link.', {
          header: <span className="font-mono">Authorization: Bearer</span>,
        })}{' '}
        <a href="/api/v1/docs" target="_blank" rel="noreferrer" className="text-accent hover:underline">{t('API reference')}</a>
      </p>
      {allowed === 0 && <Notice>{t("Your plan doesn't include API access.")}</Notice>}
      <FormError message={failure && describeKeyFailure(failure, t)} />
      {step.kind === 'created' && <NewApiKeyNotice created={step.key} onDone={() => setStep({ kind: 'idle' })} />}

      {keys === null || allowed === null ? (
        !failure && <p className={MUTED}>{t('Loading…')}</p>
      ) : keys.length ? (
        keys.map(key => <ApiKeyRow key={key.id} apiKey={key} onRevoked={reload} />)
      ) : (
        allowed > 0 && <p className={MUTED}>{t('No keys yet.')}</p>
      )}

      {keys !== null && allowed !== null && allowed > 0 && step.kind !== 'created' && (
        active >= allowed ? (
          <p className={MUTED}>{keyLimit(allowed, t)}</p>
        ) : step.kind === 'form' ? (
          <NewApiKeyForm
            onCancel={() => setStep({ kind: 'idle' })}
            onCreated={key => {
              setStep({ kind: 'created', key });
              void reload();
            }}
          />
        ) : (
          <SmallButton className="self-start" onClick={() => setStep({ kind: 'form' })}>{t('Create key…')}</SmallButton>
        )
      )}
    </Section>
  );
}
