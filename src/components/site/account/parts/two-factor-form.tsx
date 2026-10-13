'use client';

import { useState } from 'react';
import { authClient } from '@/lib/account/auth-client';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { Field, FormError, Submit, TextButton } from '@/components/site/account/form-parts';
import { FALLBACK_ERROR, useFormAction } from '@/components/site/account/use-form-action';

/** The second step of a password sign-in once 2FA is on. */
export default function TwoFactorForm() {
  const [backup, setBackup] = useState(false);
  const [expired, setExpired] = useState(false);

  const { busy, error, onSubmit } = useFormAction(async form => {
    const code = String(form.get('code')).trim();
    const { error } = backup ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code });
    // The pending sign-in lives in a short-lived cookie; once it lapses only a fresh sign-in helps.
    if (error?.code === 'INVALID_TWO_FACTOR_COOKIE') {
      setExpired(true);
      return 'That took too long. Sign in again.';
    }
    if (error) return error.code === 'INVALID_CODE' || error.code === 'INVALID_BACKUP_CODE' ? "That code didn't work." : error.message ?? FALLBACK_ERROR;
    showAccountDialog(null);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4">
      <p className="text-small text-ink-3">
        {backup ? 'Enter one of your backup codes. Each works once.' : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      <Field
        key={backup ? 'backup' : 'totp'}
        label={backup ? 'Backup code' : 'Code'}
        name="code"
        autoComplete="one-time-code"
        inputMode={backup ? 'text' : 'numeric'}
        pattern={backup ? undefined : '\\d{6}'}
        autoFocus
      />
      <FormError message={error} />
      {expired ? (
        <p className="text-small"><TextButton onClick={() => showAccountDialog({ kind: 'sign-in' })}>Back to sign in</TextButton></p>
      ) : (
        <Submit busy={busy}>Verify</Submit>
      )}
      <p className="text-small">
        <TextButton onClick={() => setBackup(v => !v)}>{backup ? 'Use the authenticator app' : 'Use a backup code'}</TextButton>
      </p>
    </form>
  );
}
