import { useEffect, useState } from 'react';
import { workspaceSession } from '@/lib/platform/workspaces/session';

/**
 * Opens the shared workspace a /w/<slug>?t= link landed with (src/app/w/[slug]/page.tsx sends it here as
 * ?w=<slug>&t=<t>), read-only. `failed` once that link turned out not to work.
 */
export function useSharedLink() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const slug = url.searchParams.get('w');
    if (slug === null) return;
    const t = Number(url.searchParams.get('t'));
    url.searchParams.delete('w');
    url.searchParams.delete('t');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    // No unmount guard: a dev double-run of this effect finds the URL already cleaned and returns above.
    void workspaceSession().viewShared(slug, Number.isInteger(t) && t > 0 ? t : null).then(failure => {
      if (failure) setFailed(true);
    });
  }, []);

  return { failed, dismiss: () => setFailed(false) };
}
