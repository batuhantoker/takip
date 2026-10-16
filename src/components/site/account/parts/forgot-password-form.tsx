'use client';

import { RESET_CALLBACK } from '@/lib/platform/account/links';
import { authClient } from '@/components/site/account/auth-client';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { Field, FormError, Notice, Submit, TextButton } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR, useFormAction } from '@/components/site/account/use-form-action';

export default function ForgotPasswordForm({ notice }: { notice?: string }) {
  const { busy, error, onSubmit } = useFormAction(async form => {
    const email = String(form.get('email'));
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: RESET_CALLBACK });
    if (error) return error.message ?? FALLBACK_ERROR;
    showAccountDialog({
      kind: 'sent',
      title: 'Check your email',
      body: `If an account uses ${email}, we sent it a link to choose a new password. It works for one hour.`,
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4">
      {notice ? (
        <Notice>{notice}</Notice>
      ) : (
        <p className="text-small text-ink-3">Enter your email and we&apos;ll send a link to choose a new password.</p>
      )}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <FormError message={error} />
      <Submit busy={busy}>Send link</Submit>
      <p className="text-small">
        <TextButton onClick={() => showAccountDialog({ kind: 'sign-in' })}>Back to sign in</TextButton>
      </p>
    </form>
  );
}
