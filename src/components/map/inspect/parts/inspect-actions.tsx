'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link2, LocateFixed, ZoomIn } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import type { MapRef } from '@/components/map/types';
import { trackLink, type TrackTarget } from '@/components/map/inspect/track-request';
import { countAction } from '@/lib/platform/usage-actions';

/** Follow, Zoom to, and a link that opens the map following this, as header icon buttons. */
export function MoveActions({ mapRef, lat, lng, zoom, following, onFollow, share }: {
  mapRef: MapRef;
  lat: number;
  lng: number;
  zoom: number;
  following?: boolean;
  onFollow?: (on: boolean) => void;
  share?: TrackTarget;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const zoomTo = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [lng, lat], zoom: Math.max(zoom, Math.min(map.getZoom(), 16)), duration: 1200, essential: true });
  };
  const copyLink = async () => {
    if (!share) return;
    // The address bar carries the layers on now (use-layer-persistence.ts).
    const layers = new URLSearchParams(window.location.search).get('layers');
    const link = trackLink(window.location.origin, share, { lat, lng, zoom }, layers);
    countAction('link.share');
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', link);
    }
  };
  return (
    <>
      {onFollow && (
        <IconButton label={following ? 'Stop following' : 'Follow'} icon={LocateFixed} active={following} onClick={() => onFollow(!following)} />
      )}
      <IconButton label="Zoom to" icon={ZoomIn} onClick={zoomTo} />
      {share && <IconButton label={copied ? 'Link copied' : 'Copy a link that follows this'} icon={copied ? Check : Link2} onClick={copyLink} />}
    </>
  );
}
