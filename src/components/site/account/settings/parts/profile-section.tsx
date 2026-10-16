'use client';

import { useState } from 'react';
import { authClient } from '@/components/site/account/auth-client';
import { Field, FormError } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR, useFormAction } from '@/components/site/account/use-form-action';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';

export default function ProfileSection({ user }: { user: { name: string; email: string; emailVerified: boolean } }) {
  const [saved, setSaved] = useState(false);
  const { busy, error, onSubmit } = useFormAction(async form => {
    setSaved(false);
    const { error } = await authClient.updateUser({ name: String(form.get('name')).trim() });
    if (error) return error.message ?? FALLBACK_ERROR;
    setSaved(true);
  });

  return (
    <Section title="Profile">
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Name" name="name" defaultValue={user.name} autoComplete="name" onChange={() => setSaved(false)} />
        </div>
        <SmallButton type="submit" disabled={busy}>{saved ? 'Saved' : 'Save'}</SmallButton>
      </form>
      <FormError message={error} />
      <Row label={user.email} detail={user.emailVerified ? 'Email confirmed' : 'Email not confirmed'} />
    </Section>
  );
}
