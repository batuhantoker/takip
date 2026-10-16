'use client';

import { useState, type FormEvent } from 'react';
import { API_KEY_SCOPES, createApiKey, daysFromNow, type NewApiKey } from '@/lib/platform/account/api-keys';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/field';
import { Field, FormError } from '@/components/site/account/form-parts';
import { describeKeyFailure } from './api-key-messages';
import { SmallButton } from '@/components/site/account/settings/settings-parts';

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
      <Select label="Expires" name="expiry" defaultValue="0" options={EXPIRY.map(({ label, days }) => ({ value: String(days), label }))} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-small font-medium text-ink-2">Limit it to <span className="font-normal text-ink-3">· nothing ticked means full access</span></legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {API_KEY_SCOPES.map(scope => (
            <Checkbox key={scope} name="scope" value={scope} label={<span className="font-mono">{scope}</span>} />
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
