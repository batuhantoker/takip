'use client';

import { authClient } from '@/components/site/account/auth-client';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FormError, PASSWORDS_DIFFER, Submit } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR, useFormAction } from '@/components/site/account/use-form-action';

export default function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { busy, error, onSubmit } = useFormAction(async form => {
    const newPassword = String(form.get('new'));
    if (newPassword !== String(form.get('repeat'))) return PASSWORDS_DIFFER;
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get('current')),
      newPassword,
      revokeOtherSessions: form.get('others') === 'on',
    });
    if (error) return error.message ?? FALLBACK_ERROR;
    onDone();
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5 pl-6">
      <Field label="Current password" name="current" type="password" autoComplete="current-password" />
      <Field label="New password" name="new" type="password" minLength={8} autoComplete="new-password" />
      <Field label="Repeat it" name="repeat" type="password" minLength={8} autoComplete="new-password" />
      <Checkbox name="others" defaultChecked label="Sign out my other devices" />
      <FormError message={error} />
      <Submit busy={busy}>Change password</Submit>
    </form>
  );
}
