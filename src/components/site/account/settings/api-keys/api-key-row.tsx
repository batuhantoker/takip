'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { isExpired, revokeApiKey, type ApiKey } from '@/lib/platform/account/api-keys';
import { timeAgo } from '@/lib/platform/account/device-label';
import { FormError } from '@/components/site/account/form-parts';
import { describeKeyFailure } from './api-key-messages';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';

// Expiry dates are the end of a UTC day, so they're shown in UTC: a zone east of it would show the next day.
const date = (at: number, t: Translate, timeZone?: string) =>
  new Date(at).toLocaleDateString(t.intl, { day: 'numeric', month: 'short', year: 'numeric', timeZone });

function details(key: ApiKey, t: Translate) {
  const expiry = key.expiresAt === null ? t('no expiry')
    : isExpired(key) ? t('expired {date}', { date: date(key.expiresAt, t, 'UTC') })
    : t('expires {date}', { date: date(key.expiresAt, t, 'UTC') });
  return [
    t('Created {date}', { date: date(key.createdAt, t) }),
    key.lastUsedAt ? t('last used {when}', { when: timeAgo(new Date(key.lastUsedAt), undefined, t) }) : t('never used'),
    expiry,
    key.scopes.length ? t('only {scopes}', { scopes: key.scopes.join(', ') }) : null,
  ].filter(Boolean).join(' · ');
}

export default function ApiKeyRow({ apiKey, onRevoked }: { apiKey: ApiKey; onRevoked: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = async () => {
    setBusy(true);
    setError(null);
    const { failure } = await revokeApiKey(apiKey.id);
    setBusy(false);
    if (failure) return setError(describeKeyFailure(failure, t));
    onRevoked();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2.5 min-h-8">
        <KeyRound className="size-4 mt-0.5 shrink-0 text-ink-3" aria-hidden />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-body text-ink-1 break-words">
            {apiKey.name} <span className="font-mono text-ink-3">{apiKey.prefix}…</span>
          </span>
          <span className={`text-small ${isExpired(apiKey) ? 'text-red' : 'text-ink-3'}`}>{details(apiKey, t)}</span>
        </div>
        {!confirming && <SmallButton onClick={() => setConfirming(true)}>{t('Revoke…')}</SmallButton>}
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="flex-1 min-w-[12rem] text-body text-ink-1">{t('Anything using this key stops working.')}</span>
          <SmallButton onClick={() => setConfirming(false)}>{t('Cancel')}</SmallButton>
          <SmallButton danger disabled={busy} onClick={revoke}>{t('Revoke key')}</SmallButton>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}
