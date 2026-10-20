'use client';

import { useEffect, useState } from 'react';
import { loadLinkPreview } from '@/lib/core/link-preview/client';
import type { LinkPreview } from '@/lib/core/link-preview/parse';

/** An article's own card, asked for once `enabled` turns true and kept after. */
export function useLinkPreview(url: string | null, enabled: boolean) {
  const [state, setState] = useState<{ url: string; preview: LinkPreview | null } | null>(null);
  const ready = !!url && state?.url === url;

  useEffect(() => {
    if (!url || !enabled || ready) return;
    let live = true;
    loadLinkPreview(url).then(preview => { if (live) setState({ url, preview }); });
    return () => { live = false; };
  }, [url, enabled, ready]);

  return { preview: ready ? state!.preview : null, loading: !!url && enabled && !ready };
}
