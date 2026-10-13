'use client';

import { useSyncExternalStore } from 'react';
import { cx } from '@/components/ui/class-names';
import { KitSection, Specimen } from '../kit-layout';

const SURFACES = [
  { token: '--surface-0', cls: 'bg-surface-0', use: 'App background, status bar' },
  { token: '--surface-1', cls: 'bg-surface-1', use: 'Sidebar, panels, floating controls' },
  { token: '--surface-2', cls: 'bg-surface-2', use: 'Inputs, cards in panels, row hover' },
  { token: '--surface-3', cls: 'bg-surface-3', use: 'Pressed and selected' },
];

const INKS = [
  { token: '--ink-1', cls: 'text-ink-1', use: 'Titles, primary text' },
  { token: '--ink-2', cls: 'text-ink-2', use: 'Body, secondary text' },
  { token: '--ink-3', cls: 'text-ink-3', use: 'Meta, labels, placeholders' },
  { token: '--ink-4', cls: 'text-ink-4', use: 'Disabled, decorative rules' },
];

const SIGNALS = [
  { token: '--accent', cls: 'bg-accent', use: 'On, focus, primary, links' },
  { token: '--gold', cls: 'bg-gold', use: 'TI only' },
  { token: '--red', cls: 'bg-red', use: 'Critical, destructive' },
  { token: '--amber', cls: 'bg-amber', use: 'Warning, elevated' },
  { token: '--green', cls: 'bg-green', use: 'Live, healthy' },
  { token: '--blue', cls: 'bg-blue', use: 'Informational' },
];

const TYPE = [
  { role: 'Display number', spec: '22 / 28 · 500 · mono', cls: 'font-mono text-display font-medium text-ink-1 tabular-nums', sample: '17,707' },
  { role: 'Panel title', spec: '15 / 20 · 600', cls: 'text-title font-semibold text-ink-1', sample: 'Alerts' },
  { role: 'Row title', spec: '13 / 18 · 500', cls: 'text-body font-medium text-ink-1', sample: 'Maritime and naval traffic' },
  { role: 'Body', spec: '13 / 18 · 400', cls: 'text-body text-ink-2', sample: 'Draw an area to see what is inside it and get told when it changes.' },
  { role: 'Secondary', spec: '12 / 16 · 400 · ink-2', cls: 'text-small text-ink-2', sample: 'USGS · 9 km SSE of La Mesa' },
  { role: 'Meta, section label', spec: '11 / 14 · 500 · ink-3', cls: 'text-meta font-medium text-ink-3', sample: 'On the map' },
];

const noop = () => () => {};

/** The live value of a token, so the page never drifts from globals.css. */
function useToken(token: string) {
  return useSyncExternalStore(noop, () => getComputedStyle(document.documentElement).getPropertyValue(token).trim(), () => '');
}

function Swatch({ cls, token, use }: { cls: string; token: string; use: string }) {
  const value = useToken(token);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className={cx('h-14 rounded-card border border-line', cls)} />
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-meta text-ink-1">{token}</span>
        <span className="truncate font-mono text-meta text-ink-3">{value || '\u00a0'}</span>
        <span className="mt-0.5 text-small text-ink-2">{use}</span>
      </div>
    </div>
  );
}

export function Foundations() {
  return (
    <KitSection id="foundations" title="Foundations" source="src/app/globals.css"
      lead="Neutral, faintly cool surfaces so the map carries the colour. One accent for things you can act on. Red, amber and green only for severity and status; gold belongs to TI.">
      <Specimen caption="Surfaces step up by about 3% lightness. Panels are surface-1; nothing on top of the map is translucent.">
        <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          {SURFACES.map(s => <Swatch key={s.token} {...s} />)}
        </div>
      </Specimen>
      <Specimen caption="Selected is neutral: surface-3 and ink-1. If more than a few things on screen are accent, something is wrong.">
        <div className="grid w-full grid-cols-3 gap-4 sm:grid-cols-6">
          {SIGNALS.map(s => <Swatch key={s.token} {...s} />)}
        </div>
      </Specimen>
      <Specimen caption="Four inks. Body copy is ink-2; ink-4 is never used for words someone has to read.">
        <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          {INKS.map(s => <Ink key={s.token} {...s} />)}
        </div>
      </Specimen>
      <Specimen stage="p-0" caption="Geist for words, Geist Mono for numbers only. Nothing below 11 px, nothing letter-spaced in capitals.">
        <div className="w-full divide-y divide-line">
          {TYPE.map(t => (
            <div key={t.role} className="grid grid-cols-[160px_1fr] items-baseline gap-6 px-6 py-3.5 max-sm:grid-cols-1 max-sm:gap-1">
              <div className="flex flex-col">
                <span className="text-small text-ink-2">{t.role}</span>
                <span className="font-mono text-meta text-ink-3">{t.spec}</span>
              </div>
              <span className={cx('truncate', t.cls)}>{t.sample}</span>
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen caption="Radius 6 for controls, 8 for cards and inputs, 12 for floating surfaces. Floating things get one shadow and a hairline; nothing glows.">
        <div className="flex flex-wrap items-end gap-6">
          <Shape radius="rounded-control" label="Controls · 6" className="h-8 w-24 bg-surface-2" />
          <Shape radius="rounded-card" label="Cards, inputs · 8" className="h-16 w-32 bg-surface-2" />
          <Shape radius="rounded-float" label="Floating · 12" className="h-20 w-40 bg-surface-1 shadow-float" />
        </div>
      </Specimen>
    </KitSection>
  );
}

function Ink({ cls, token, use }: { cls: string; token: string; use: string }) {
  const value = useToken(token);
  return (
    <div className="flex flex-col gap-1">
      <span className={cx('text-display font-semibold', cls)}>Aa</span>
      <span className="font-mono text-meta text-ink-1">{token}</span>
      <span className="font-mono text-meta text-ink-3">{value || '\u00a0'}</span>
      <span className="text-small text-ink-2">{use}</span>
    </div>
  );
}

function Shape({ radius, label, className }: { radius: string; label: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cx('border border-line', radius, className)} />
      <span className="text-meta text-ink-3">{label}</span>
    </div>
  );
}
