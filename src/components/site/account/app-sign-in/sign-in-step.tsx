'use client';

import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/components/site/account/auth-client';
import { PROVIDER_LABELS, isProviderId } from '@/components/site/account/providers';
import { useT } from '@/components/ui/use-t';
import { HANDOFF_STATE_KEY, handoffPath } from '@/lib/platform/native/handoff';
import StepFrame from './step-frame';

/** In the system browser: goes on to the provider, which comes back to /app/handoff. */
export default function SignInStep({ provider, returnTo, state }: { provider: string; returnTo: string; state: string }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  // Strict Mode runs effects twice in dev; two sign-ins would race their state cookies.
  const started = useRef(false);
  const known = isProviderId(provider);

  useEffect(() => {
    if (!known || !state || started.current) return;
    started.current = true;
    sessionStorage.setItem(HANDOFF_STATE_KEY, state);
    const back = handoffPath(returnTo, state);
    void authClient.signIn.social({ provider, callbackURL: back, errorCallbackURL: back })
      .then(({ error }) => error && setFailed(true));
  }, [known, provider, returnTo, state]);

  if (!known || !state || failed) return <StepFrame title={t("Couldn't reach {provider}. Try again.", { provider: known ? PROVIDER_LABELS[provider] : provider })} />;
  return <StepFrame title={t('Continuing to {provider}…', { provider: PROVIDER_LABELS[provider] })} />;
}
