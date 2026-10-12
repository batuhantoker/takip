'use client';

import { useState, type FormEvent } from 'react';
import { API_KEY_SCOPES, createApiKey, daysFromNow, type NewApiKey } from '@/lib/api-keys';
import { Field, FormError, INPUT } from '../form-parts';
import { describeKeyFailure } from './api-key-messages';
import { SmallButton } from './settings-parts';

const EXPIRY = [
  { label: 'Never', days: 0 },
  { label: 'In 30 days', days: 30 },
  { label: 'In 90 days', days: 90 },
  { label: 'In a year', days: 365 },
];

export default function NewApiKeyForm({ onCreated, onCancel }: { onCreated: (key: NewApiKey) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const days = Number(form.get('expiry'));
    setBusy(true);
    setError(null);
    const { data, failure } = await createApiKey({
      name: String(form.get('name')).trim(),
      scopes: form.getAll('scope').map(String),
      expiresAt: days ? daysFromNow(days) : null,
    });
    setBusy(false);
    if (failure) return setError(describeKeyFailure(failure));
    onCreated(data);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <Field label="Name" name="name" maxLength={64} placeholder="What will use it, e.g. home server" autoFocus />
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-[var(--text-muted)]">Expires</span>
        <select name="expiry" defaultValue="0" className={INPUT}>
          {EXPIRY.map(({ label, days }) => <option key={days} value={days}>{label}</option>)}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[11px] text-[var(--text-muted)]">Limit it to (optional; nothing ticked means full access)</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {API_KEY_SCOPES.map(scope => (
            <label key={scope} className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-primary)]">
              <input type="checkbox" name="scope" value={scope} className="accent-[var(--gold-primary)]" />
              {scope}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={error} />
      <div className="flex items-center gap-2">
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        <SmallButton type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create key'}</SmallButton>
      </div>
    </form>
  );
}
