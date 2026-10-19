'use client';

import { useEffect, useRef, useState } from 'react';
import { AD_CLIENT } from '@/lib/platform/ads';
import { useT } from '@/components/ui/use-t';
import { useAds } from './ads-provider';

declare global {
  interface Window { adsbygoogle?: object[] }
}

const VARIANTS = {
  panel: { ins: 'block w-full h-[100px] [@media(min-height:900px)]:h-[250px]', format: undefined },
  page: { ins: 'block w-full', format: 'auto' },
} as const;

// StrictMode runs effects twice on the same node, and a second push throws "already have ads".
const filled = new WeakSet<Element>();

/** One AdSense unit. Renders nothing for plans without ads, under a blocker, or once Google has nothing to fill it with. */
export default function AdSlot({ slot, variant, visible = true, className = '' }: {
  slot: string | null;
  variant: keyof typeof VARIANTS;
  /** Hide without unmounting, so reopening a panel doesn't request a new ad. */
  visible?: boolean;
  className?: string;
}) {
  const t = useT();
  const { on, blocked } = useAds();
  // Responsive units can't size inside display:none, so the first request waits until it's shown.
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);

  if (!on || blocked || !slot || !AD_CLIENT || !shown) return null;
  return (
    <aside aria-label={t('Advertisement')}
      className={`${visible ? '' : 'hidden'} [&:has(ins[data-ad-status=unfilled])]:hidden ${className}`}>
      <p className="mb-1.5 text-meta text-ink-3">{t('Advertisement')}</p>
      <AdUnit client={AD_CLIENT} slot={slot} variant={variant} />
    </aside>
  );
}

function AdUnit({ client, slot, variant }: { client: string; slot: string; variant: keyof typeof VARIANTS }) {
  const ref = useRef<HTMLModElement>(null);
  const { ins, format } = VARIANTS[variant];

  useEffect(() => {
    const el = ref.current;
    if (!el || filled.has(el)) return;
    filled.add(el);
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {}
  }, []);

  return (
    <ins ref={ref} className={`adsbygoogle ${ins}`} data-ad-client={client} data-ad-slot={slot}
      data-ad-format={format} data-full-width-responsive={format ? 'true' : undefined} />
  );
}
