'use client';

import { RESET_CALLBACK } from '@/lib/platform/account/links';
import { authClient } from '@/components/site/account/auth-client';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { Field, FormError, Notice, Submit, TextButton } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR, useFormAction } from '@/components/site/account/use-form-action';
import { useT } from '@/components/ui/use-t';

export default function ForgotPasswordForm({ notice }: { notice?: string }) {
  const t = useT();
  const { busy, error, onSubmit } = useFormAction(async form => {
    const email = String(form.get('email'));
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: RESET_CALLBACK });
    if (error) return error.message ?? t(FALLBACK_ERROR);
    showAccountDialog({
      kind: 'sent',
      title: t('Check your email'),
      body: t('If an account uses {email}, we sent it a link to choose a new password. It works for one hour.', { email }),
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4">
      {notice ? (
        <Notice>{notice}</Notice>
      ) : (
        <p className="text-small text-ink-3">{t("Enter your email and we'll send a link to choose a new password.")}</p>
      )}
      <Field label={t('Email')} name="email" type="email" autoComplete="email" />
      <FormError message={error} />
      <Submit busy={busy}>{t('Send link')}</Submit>
      <p className="text-small">
        <TextButton onClick={() => showAccountDialog({ kind: 'sign-in' })}>{t('Back to sign in')}</TextButton>
      </p>
    </form>
  );
}
