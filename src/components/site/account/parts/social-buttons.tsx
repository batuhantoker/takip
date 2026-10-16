'use client';

import { useEffect, useState } from 'react';
import { SIGN_IN_FAILED_CALLBACK } from '@/lib/platform/account/links';
import { authClient } from '@/components/site/account/auth-client';
import { Button } from '@/components/ui/button';
import { PROVIDER_ICONS } from './provider-icons';
import { PROVIDER_LABELS as LABELS, loadProviders, type ProviderId } from '@/components/site/account/providers';

export default function SocialButtons() {
  const [providers, setProviders] = useState<ProviderId[]>([]);
  const [pending, setPending] = useState<ProviderId | null>(null);
  const [failed, setFailed] = useState<ProviderId | null>(null);

  useEffect(() => {
    let live = true;
    void loadProviders().then(list => {
      if (live) setProviders(list);
    });
    return () => {
      live = false;
    };
  }, []);

  if (providers.length === 0) return null;

  const signIn = async (provider: ProviderId) => {
    setPending(provider);
    setFailed(null);
    // On success the client follows the provider's redirect and comes back to this same view.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: `${window.location.pathname}${window.location.search}`,
      errorCallbackURL: SIGN_IN_FAILED_CALLBACK,
    });
    if (error) {
      setPending(null);
      setFailed(provider);
    }
  };

  // With an odd count the first provider gets the full row, so the grid stays even.
  const featured = providers.length % 2 === 1 ? providers[0] : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {providers.map(id => (
          <Button key={id} disabled={pending !== null && pending !== id} loading={pending === id} onClick={() => signIn(id)}
            className={id === featured ? 'col-span-2' : undefined}>
            {pending !== id && PROVIDER_ICONS[id]}
            {id === featured ? `Continue with ${LABELS[id]}` : LABELS[id]}
          </Button>
        ))}
      </div>
      {failed && <p role="alert" className="text-small text-red">Couldn&apos;t reach {LABELS[failed]}. Try again.</p>}
      <div className="flex items-center gap-2 text-meta text-ink-3">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
