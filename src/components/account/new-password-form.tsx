'use client';

import { authClient } from '@/lib/auth-client';
import { showAccountDialog } from './account-dialog-state';
import { Field, FormError, PASSWORDS_DIFFER, Submit, TextButton } from './form-parts';
import { FALLBACK_ERROR, useFormAction } from './use-form-action';

export default function NewPasswordForm({ token }: { token: string }) {
  const { busy, error, onSubmit } = useFormAction(async form => {
    const newPassword = String(form.get('password'));
    if (newPassword !== String(form.get('confirm'))) return PASSWORDS_DIFFER;
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) return error.message ?? FALLBACK_ERROR;
    showAccountDialog({ kind: 'sign-in', notice: 'Password changed. Sign in with your new password.' });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4">
      <Field label="New password" name="password" type="password" minLength={8} autoComplete="new-password" />
      <Field label="Repeat it" name="confirm" type="password" minLength={8} autoComplete="new-password" />
      <FormError message={error} />
      {error && error !== PASSWORDS_DIFFER && (
        <p className="text-[11px]">
          <TextButton onClick={() => showAccountDialog({ kind: 'forgot' })}>Ask for a new link</TextButton>
        </p>
      )}
      <Submit busy={busy}>Set password</Submit>
    </form>
  );
}
