'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { isExpired, revokeApiKey, type ApiKey } from '@/lib/platform/account/api-keys';
import { timeAgo } from '@/lib/platform/account/device-label';
import { FormError } from '@/components/site/account/form-parts';
import { describeKeyFailure } from './api-key-messages';
import { SmallButton } from '@/components/site/account/settings/settings-parts';

// Expiry dates are the end of a UTC day, so they're shown in UTC: a zone east of it would show the next day.
const date = (at: number, timeZone?: string) => new Date(at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone });

function details(key: ApiKey) {
  return [
    `Created ${date(key.createdAt)}`,
    key.lastUsedAt ? `last used ${timeAgo(new Date(key.lastUsedAt))}` : 'never used',
    key.expiresAt === null ? 'no expiry' : `${isExpired(key) ? 'expired' : 'expires'} ${date(key.expiresAt, 'UTC')}`,
    key.scopes.length ? `only ${key.scopes.join(', ')}` : null,
  ].filter(Boolean).join(' · ');
}

export default function ApiKeyRow({ apiKey, onRevoked }: { apiKey: ApiKey; onRevoked: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = async () => {
    setBusy(true);
    setError(null);
    const { failure } = await revokeApiKey(apiKey.id);
    setBusy(false);
    if (failure) return setError(describeKeyFailure(failure));
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
          <span className={`text-small ${isExpired(apiKey) ? 'text-red' : 'text-ink-3'}`}>{details(apiKey)}</span>
        </div>
        {!confirming && <SmallButton onClick={() => setConfirming(true)}>Revoke…</SmallButton>}
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="flex-1 min-w-[12rem] text-body text-ink-1">Anything using this key stops working.</span>
          <SmallButton onClick={() => setConfirming(false)}>Cancel</SmallButton>
          <SmallButton danger disabled={busy} onClick={revoke}>Revoke key</SmallButton>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}
