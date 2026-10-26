'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { countLayersOn } from '@/components/shell/sidebar/nav-items';
import { formatPosition } from '@/components/shell/status-bar/use-cursor-readout';
import { trackKey, trackedNow } from '@/components/map/inspect/track-request';
import { viewPath } from '@/lib/map/view-link';
import { countAction } from '@/lib/platform/usage-actions';
import { useAppPlatform } from '@/components/shell/native/use-app-platform';

interface SharePanelProps {
  /** Where the map is looking; use-startup.ts reads lat, lon and zoom back from the link. */
  center: { lat: number; lng: number } | null;
  zoom: number;
  activeLayers: Record<string, boolean>;
}

/** A link to this view (place, zoom, layers and what it follows), to copy or post. */
export default function SharePanel({ center, zoom, activeLayers }: SharePanelProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const lat = center?.lat ?? 20;
  const lng = center?.lng ?? 0;
  const layersOn = countLayersOn(activeLayers);

  const url = useCallback(() => {
    // What the map follows travels too; the link opens following it.
    const tracked = trackedNow();
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}${viewPath({ lat, lng, zoom, layers: activeLayers, track: tracked && trackKey(tracked) })}`;
  }, [lat, lng, zoom, activeLayers]);

  const copy = async () => {
    const link = url();
    countAction('link.share');
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  // The phone apps have the system share sheet, which already lists every app the person uses.
  const platform = useAppPlatform();
  const phoneApp = platform === 'ios' || platform === 'android';
  const share = async () => {
    countAction('link.share');
    await (await import('@/lib/platform/native/bridge')).shareLink(url(), t('A view on TAKIP'));
  };

  const link = encodeURIComponent(url());
  const caption = encodeURIComponent(t('A view on TAKIP'));
  const targets = [
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${caption}&url=${link}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
    { label: 'Reddit', href: `https://reddit.com/submit?url=${link}&title=${caption}` },
  ];

  return (
    <section aria-labelledby="share-title" className="mt-6">
      <h3 id="share-title" className="mb-1 text-meta font-medium text-ink-3">{t('Share this view')}</h3>
      <p className="mb-3 text-small text-ink-2">
        <span className="font-mono tabular-nums">{formatPosition(lat, lng)}</span> · {t.rich('zoom {level}', { level: <span className="font-mono tabular-nums">{zoom.toFixed(1)}</span> })} · {t('{n, plural, one {# layer} other {# layers}}', { n: layersOn })}
      </p>
      <div className="flex gap-2">
        <Button variant="primary" icon={copied ? Check : Copy} onClick={copy} className="flex-1">{copied ? t('Link copied') : t('Copy link')}</Button>
        {phoneApp && <Button icon={Share2} onClick={() => void share()}>{t('link|Share')}</Button>}
        {!phoneApp && targets.map(target => (
          <a key={target.label} href={target.href} target="_blank" rel="noopener noreferrer"
            className={cx('inline-flex h-8 items-center rounded-control border border-line-strong bg-surface-2 px-3 text-body font-medium text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION)}>
            {target.label}
          </a>
        ))}
      </div>
    </section>
  );
}
