'use client';

import { VERIFIED_CALLBACK } from '@/lib/account-links';
import { authClient } from '@/lib/auth-client';
import { showAccountDialog } from './account-dialog-state';
import { Field, FormError, Notice, Submit, TextButton } from './form-parts';
import SocialButtons from './social-buttons';
import { FALLBACK_ERROR, useFormAction } from './use-form-action';

export default function CredentialsForm({ mode, notice }: { mode: 'sign-in' | 'sign-up'; notice?: string }) {
  const signingIn = mode === 'sign-in';

  const { busy, error, onSubmit } = useFormAction(async form => {
    const email = String(form.get('email'));
    const password = String(form.get('password'));

    if (!signingIn) {
      const { error } = await authClient.signUp.email({ name: String(form.get('name')), email, password, callbackURL: VERIFIED_CALLBACK });
      if (error) return error.message ?? FALLBACK_ERROR;
      return showAccountDialog({
        kind: 'sent',
        title: 'Check your email',
        body: `We sent a link to ${email}. Open it to finish creating your account. It works for one hour.`,
      });
    }

    // No callbackURL here: the client would follow it after every successful sign-in.
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error?.code === 'EMAIL_NOT_VERIFIED') {
      await authClient.sendVerificationEmail({ email, callbackURL: VERIFIED_CALLBACK });
      return showAccountDialog({
        kind: 'sent',
        title: 'Confirm your email first',
        body: `We sent a new link to ${email}. Open it and you're signed in.`,
      });
    }
    if (error) return error.message ?? FALLBACK_ERROR;
    // The password was right; with 2FA on there is no session until the code.
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) return showAccountDialog({ kind: 'two-factor' });
    showAccountDialog(null);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4">
      {notice && <Notice>{notice}</Notice>}
      <SocialButtons />
      {!signingIn && <Field label="Name" name="name" autoComplete="name" />}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        minLength={8}
        autoComplete={signingIn ? 'current-password' : 'new-password'}
      />
      {signingIn && (
        <p className="-mt-1 text-right text-[11px]">
          <TextButton onClick={() => showAccountDialog({ kind: 'forgot' })}>Forgot password?</TextButton>
        </p>
      )}
      <FormError message={error} />
      <Submit busy={busy}>{signingIn ? 'Sign in' : 'Create account'}</Submit>
      <p className="text-[11px] text-[var(--text-muted)]">
        {signingIn ? 'No account yet? ' : 'Already have an account? '}
        <TextButton onClick={() => showAccountDialog({ kind: signingIn ? 'sign-up' : 'sign-in' })}>
          {signingIn ? 'Create one' : 'Sign in'}
        </TextButton>
      </p>
    </form>
  );
}
