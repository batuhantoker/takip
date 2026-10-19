'use client';

import { VERIFIED_CALLBACK } from '@/lib/platform/account/links';
import { authClient } from '@/components/site/account/auth-client';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { Field, FormError, Notice, Submit, TextButton } from '@/components/site/account/form-parts';
import SocialButtons from './social-buttons';
import { FALLBACK_ERROR, useFormAction } from '@/components/site/account/use-form-action';
import { useT } from '@/components/ui/use-t';

export default function CredentialsForm({ mode, notice }: { mode: 'sign-in' | 'sign-up'; notice?: string }) {
  const t = useT();
  const signingIn = mode === 'sign-in';

  const { busy, error, onSubmit } = useFormAction(async form => {
    const email = String(form.get('email'));
    const password = String(form.get('password'));

    if (!signingIn) {
      const { error } = await authClient.signUp.email({ name: String(form.get('name')), email, password, callbackURL: VERIFIED_CALLBACK });
      if (error) return error.message ?? t(FALLBACK_ERROR);
      return showAccountDialog({
        kind: 'sent',
        title: t('Check your email'),
        body: t('We sent a link to {email}. Open it to finish creating your account. It works for one hour.', { email }),
      });
    }

    // No callbackURL here: the client would follow it after every successful sign-in.
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error?.code === 'EMAIL_NOT_VERIFIED') {
      await authClient.sendVerificationEmail({ email, callbackURL: VERIFIED_CALLBACK });
      return showAccountDialog({
        kind: 'sent',
        title: t('Confirm your email first'),
        body: t("We sent a new link to {email}. Open it and you're signed in.", { email }),
      });
    }
    if (error) return error.message ?? t(FALLBACK_ERROR);
    // The password was right; with 2FA on there is no session until the code.
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) return showAccountDialog({ kind: 'two-factor' });
    showAccountDialog(null);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4">
      {notice && <Notice>{notice}</Notice>}
      <SocialButtons />
      {!signingIn && <Field label={t('Name')} name="name" autoComplete="name" />}
      <Field label={t('Email')} name="email" type="email" autoComplete="email" />
      <Field
        label={t('Password')}
        name="password"
        type="password"
        minLength={8}
        autoComplete={signingIn ? 'current-password' : 'new-password'}
      />
      {signingIn && (
        <p className="-mt-1 text-right text-small">
          <TextButton onClick={() => showAccountDialog({ kind: 'forgot' })}>{t('Forgot password?')}</TextButton>
        </p>
      )}
      <FormError message={error} />
      <Submit busy={busy}>{signingIn ? t('Sign in') : t('Create account')}</Submit>
      <p className="text-small text-ink-3">
        {signingIn ? t('No account yet?') : t('Already have an account?')}{' '}
        <TextButton onClick={() => showAccountDialog({ kind: signingIn ? 'sign-up' : 'sign-in' })}>
          {signingIn ? t('Create one') : t('Sign in')}
        </TextButton>
      </p>
    </form>
  );
}
