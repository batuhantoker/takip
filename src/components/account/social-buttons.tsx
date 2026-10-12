'use client';

import { useEffect, useState } from 'react';
import { SIGN_IN_FAILED_CALLBACK } from '@/lib/account-links';
import { authClient } from '@/lib/auth-client';
import { PROVIDER_ICONS } from './provider-icons';
import { PROVIDER_LABELS as LABELS, loadProviders, type ProviderId } from './providers';

const BUTTON =
  'h-8 px-2.5 flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-[11px] text-[var(--text-primary)] disabled:opacity-50 transition-colors';

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
          <button
            key={id}
            type="button"
            disabled={pending !== null}
            onClick={() => signIn(id)}
            className={`${BUTTON} ${id === featured ? 'col-span-2' : ''}`}
          >
            {PROVIDER_ICONS[id]}
            <span>{id === featured ? `Continue with ${LABELS[id]}` : LABELS[id]}</span>
          </button>
        ))}
      </div>
      {failed && <p role="alert" className="text-[11px] text-[var(--alert-red)]">Couldn&apos;t reach {LABELS[failed]}. Try again.</p>}
      <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
        <span className="h-px flex-1 bg-white/10" />
        or with email
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
