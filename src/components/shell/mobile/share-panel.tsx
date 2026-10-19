'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { countLayersOn } from '@/components/shell/sidebar/nav-items';
import { formatPosition } from '@/components/shell/status-bar/use-cursor-readout';
import { trackKey, trackedNow } from '@/components/map/inspect/track-request';
import { viewPath } from '@/lib/map/view-link';
import { countAction } from '@/lib/platform/usage-actions';

interface SharePanelProps {
  /** Where the map is looking; use-startup.ts reads lat, lon and zoom back from the link. */
  center: { lat: number; lng: number } | null;
  zoom: number;
  activeLayers: Record<string, boolean>;
}

/** A link to this view (place, zoom, layers and what it follows), to copy or post. */
export default function SharePanel({ center, zoom, activeLayers }: SharePanelProps) {
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

  const link = encodeURIComponent(url());
  const targets = [
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent('A view on TAKIP')}&url=${link}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
    { label: 'Reddit', href: `https://reddit.com/submit?url=${link}&title=${encodeURIComponent('A view on TAKIP')}` },
  ];

  return (
    <section aria-labelledby="share-title" className="mt-6">
      <h3 id="share-title" className="mb-1 text-meta font-medium text-ink-3">Share this view</h3>
      <p className="mb-3 text-small text-ink-2">
        <span className="font-mono tabular-nums">{formatPosition(lat, lng)}</span> · zoom <span className="font-mono tabular-nums">{zoom.toFixed(1)}</span> · {layersOn} {layersOn === 1 ? 'layer' : 'layers'}
      </p>
      <div className="flex gap-2">
        <Button variant="primary" icon={copied ? Check : Copy} onClick={copy} className="flex-1">{copied ? 'Link copied' : 'Copy link'}</Button>
        {targets.map(t => (
          <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer"
            className={cx('inline-flex h-8 items-center rounded-control border border-line-strong bg-surface-2 px-3 text-body font-medium text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION)}>
            {t.label}
          </a>
        ))}
      </div>
    </section>
  );
}
