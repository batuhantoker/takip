'use client';

import { useEffect, useRef } from 'react';
import { authClient } from '@/components/site/account/auth-client';
import { useT } from '@/components/ui/use-t';
import { SIGN_IN_FAILED_CALLBACK } from '@/lib/platform/account/links';
import { safeReturn, SIGN_IN_STATE_KEY } from '@/lib/platform/native/handoff';
import StepFrame from './step-frame';

/** In the app, handed the sign-in back: trades the token for the session, then returns to where sign-in began. */
export default function VerifyStep({ ott, returnTo, state, error }: { ott: string | null; returnTo: string; state: string; error: string | null }) {
  const t = useT();
  // Strict Mode runs effects twice in dev; the second run would find the state gone and the token spent.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const fail = (code: string) => location.replace(`${SIGN_IN_FAILED_CALLBACK}&error=${encodeURIComponent(code)}`);
    // Only a sign-in this web view started: anyone can send the app a link.
    const started = sessionStorage.getItem(SIGN_IN_STATE_KEY);
    sessionStorage.removeItem(SIGN_IN_STATE_KEY);
    if (!state || state !== started) return fail('state_mismatch');
    if (error || !ott) return fail(error ?? 'no_token');
    void authClient.oneTimeToken.verify({ token: ott }).then(({ error: failed }) =>
      failed ? fail('invalid_token') : location.replace(safeReturn(returnTo)));
  }, [ott, returnTo, state, error]);

  return <StepFrame title={t('Signing you in…')} />;
}
