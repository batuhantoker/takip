/**
 * One anatomy for every HTML map popup: a kicker with a status dot, a title,
 * an optional subtitle, label/value rows, a quiet note and source links.
 * Styled by src/components/map/map-popup.css. Text arguments are escaped here;
 * `body` is trusted HTML the caller has already escaped.
 */

export type PopTone = 'red' | 'amber' | 'green' | 'blue' | 'violet' | 'neutral';

export interface PopRow {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  tone?: PopTone;
}

export interface PopSpec {
  kicker?: string;
  tone?: PopTone;
  /** A literal colour for the kicker dot, for feeds that bring their own. */
  dot?: string;
  /** Quiet context on the kicker line: "4 min ago". */
  meta?: string;
  title: string;
  subtitle?: string;
  body?: string;
  rows?: Array<PopRow | false | null | undefined>;
  /** Trusted HTML after the rows, like `body`. */
  foot?: string;
  note?: string;
  links?: Array<{ href: unknown; label: string } | false | null | undefined>;
  wide?: boolean;
}

export const htmlEsc = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Escaped for an href/src attribute: a quote in a feed URL would otherwise open a handler.
export const urlSafe = (s: unknown): string => { const u = String(s ?? ''); return /^https?:\/\//i.test(u) ? htmlEsc(u) : '#'; };

const HEX = /^#[0-9a-f]{3,8}$/i;

export function pop(spec: PopSpec): string {
  const dot = spec.dot && HEX.test(spec.dot)
    ? `<span class="tk-pop-dot" style="background:${spec.dot}"></span>`
    : spec.tone ? `<span class="tk-pop-dot tk-bg-${spec.tone}"></span>` : '';
  const head = spec.kicker
    ? `<div class="tk-pop-kicker">${dot}<span>${htmlEsc(spec.kicker)}</span>${spec.meta ? `<span class="tk-pop-meta">${htmlEsc(spec.meta)}</span>` : ''}</div>`
    : '';
  const rows = (spec.rows ?? []).filter((r): r is PopRow => !!r && r.value != null && r.value !== '');
  const links = (spec.links ?? []).filter((l): l is { href: unknown; label: string } => !!l);
  return `<div class="tk-pop${spec.wide ? ' tk-pop-wide' : ''}${head ? '' : ' tk-pop-nohead'}">
  ${head}
  <div class="tk-pop-title">${htmlEsc(spec.title)}</div>
  ${spec.subtitle ? `<div class="tk-pop-sub">${htmlEsc(spec.subtitle)}</div>` : ''}
  ${spec.body ? `<div class="tk-pop-body">${spec.body}</div>` : ''}
  ${rows.length ? `<dl class="tk-pop-rows">${rows.map(r => `<dt>${htmlEsc(r.label)}</dt><dd class="${[r.mono ? 'tk-mono' : '', r.tone && r.tone !== 'neutral' ? `tk-fg-${r.tone}` : ''].join(' ').trim()}">${htmlEsc(r.value)}</dd>`).join('')}</dl>` : ''}
  ${spec.foot ?? ''}
  ${spec.note ? `<div class="tk-pop-note">${htmlEsc(spec.note)}</div>` : ''}
  ${links.length ? `<div class="tk-pop-links">${links.map(l => `<a href="${urlSafe(l.href)}" target="_blank" rel="noopener noreferrer">${htmlEsc(l.label)}</a>`).join('')}</div>` : ''}
</div>`;
}

/** "40.7128° N, 74.0060° W" */
export const popCoords = (lat: number, lng: number, digits = 3) =>
  `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(digits)}° ${lng >= 0 ? 'E' : 'W'}`;

/** "LOW" → "Low", "disrupted" → "Disrupted", "Active Conflict Zone" stays as written. */
export const sentence = (s: unknown): string => {
  const t = String(s ?? '').trim().replace(/_/g, ' ');
  const base = t === t.toUpperCase() ? t.toLowerCase() : t;
  return base.charAt(0).toUpperCase() + base.slice(1);
};
