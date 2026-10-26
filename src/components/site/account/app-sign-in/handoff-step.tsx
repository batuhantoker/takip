'use client';

import { useState, useSyncExternalStore } from 'react';
import { authClient } from '@/components/site/account/auth-client';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { appAuthLink, HANDOFF_STATE_KEY } from '@/lib/platform/native/handoff';
import StepFrame from './step-frame';

const never = () => () => {};

/**
 * In the system browser, back from the provider. The one-time token is minted only on a tap, and only in the tab
 * /app/sign-in started: anything can claim the app's scheme, so a page that minted on load would hand any visitor's
 * session to it.
 */
export default function HandoffStep({ returnTo, state, error }: { returnTo: string; state: string; error: string | null }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const started = useSyncExternalStore(never, () => !!state && sessionStorage.getItem(HANDOFF_STATE_KEY) === state, () => true);

  if (!started) return <StepFrame title={t("Signing in didn't work. Try again, or use another option.")} />;

  const back = async () => {
    setBusy(true);
    const { data } = error ? { data: null } : await authClient.oneTimeToken.generate();
    sessionStorage.removeItem(HANDOFF_STATE_KEY);
    location.href = appAuthLink(data ? { ott: data.token } : { error: error ?? 'no_session' }, returnTo, state);
  };

  return (
    <StepFrame title={error ? t("Signing in didn't work. Try again, or use another option.") : t('Signed in')}>
      {!error && <p className="max-w-[22rem] text-small text-ink-3">{t('Only continue if you started signing in from the TAKIP app.')}</p>}
      <Button variant="primary" loading={busy} onClick={() => void back()}>{t('Back to the TAKIP app')}</Button>
    </StepFrame>
  );
}
