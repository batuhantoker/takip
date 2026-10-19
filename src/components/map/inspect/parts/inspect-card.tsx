'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, MapPin } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx, ENTER, type IconType } from '@/components/ui/class-names';
import { WindowFoldButton, useWindowControls } from '@/components/map/windows';
import { Panel } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { coords } from '@/components/map/inspect/format';

/** The card's frame: the kit's floating Panel, with tags under the header and sections below. */
export function InspectCard({ icon, title, subtitle, tags, onClose, headerActions, footer, children }: {
  icon: IconType;
  title: string;
  subtitle?: ReactNode;
  tags?: ReactNode;
  onClose: () => void;
  /** Icon buttons before Close: Follow, Zoom to. */
  headerActions?: ReactNode;
  /** The one primary action, then freshness. */
  footer?: ReactNode;
  children?: ReactNode;
}) {
  // In a window the window answers Escape and animates the entry.
  const windowed = !!useWindowControls();
  return (
    <Panel docked={false} title={title} subtitle={subtitle} icon={icon} onClose={onClose} footer={footer} closeOnEscape={!windowed}
      actions={<>{headerActions}<WindowFoldButton /></>}
      className={cx('pointer-events-auto', !windowed && ENTER)}>
      {tags && <div className="mb-5 flex flex-wrap gap-1.5">{tags}</div>}
      {children}
    </Panel>
  );
}

/** The three numbers that matter most, side by side. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-4">{children}</div>;
}

/** Where it is: the place, the coordinates, and a copy button. */
export function WhereRow({ lat, lng, place }: { lat: number; lng: number; place: string | null }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const text = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface-2 py-2 pr-1.5 pl-3">
      <MapPin aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className={cx('truncate text-body', place ? 'font-medium text-ink-1' : 'text-ink-3')} title={place ?? undefined}>
          {place ?? t('Finding the place…')}
        </div>
        <div className="truncate font-mono text-small text-ink-2 tabular-nums">{coords(lat, lng)}</div>
      </div>
      <IconButton label={copied ? t('Copied') : t('Copy coordinates')} icon={copied ? Check : Copy} size="sm" onClick={copy} tooltipSide="left" />
    </div>
  );
}

/** Outbound links: "FlightAware ↗  ADS-B Exchange ↗". */
export function SourceLinks({ links }: { links: Array<{ href: string; label: string } | false | null | undefined> }) {
  const shown = links.filter((l): l is { href: string; label: string } => !!l);
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {shown.map(l => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-sm text-small text-ink-2 transition-colors hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {l.label}
          <ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
        </a>
      ))}
    </div>
  );
}

/** A quiet one-line status inside the card body. */
export function Note({ children, icon: Icon }: { children: ReactNode; icon?: IconType }) {
  return (
    <p className="flex items-center gap-1.5 text-small text-ink-3">
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />}
      {children}
    </p>
  );
}
