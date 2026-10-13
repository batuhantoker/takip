import { htmlEsc, pop } from '@/lib/map/popups/kit';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;


/** "Go" is confirmed; everything else (TBD, TBC, Hold) is a plan that may move. */
export const launchColor = (status: unknown) => (status === 'Go' ? '#00E676' : status === 'Hold' ? '#FF9500' : '#4FC3F7');

export function launchPopupHtml(p: Props): string {
  let later: { name: string; when: string }[] = [];
  try {
    later = JSON.parse(String(p.later ?? '[]'));
  } catch { /* keep the popup without the list */ }
  const webcast = p.webcast_live === true || p.webcast_live === 'true';
  return pop({
    kicker: 'Launch',
    dot: launchColor(p.status),
    meta: p.status_name ? String(p.status_name) : undefined,
    title: p.name,
    subtitle: [p.pad, p.location].filter(Boolean).join(' · ') || undefined,
    rows: [
      { label: 'No earlier than', value: p.when, mono: true },
      { label: 'Provider', value: p.provider || null },
      webcast && { label: 'Webcast', value: 'Live now', tone: 'green' },
    ],
    body: later.length
      ? `<div class="tk-pop-label">Also from this pad</div>${later.map(l => `<div><span class="tk-mono">${htmlEsc(l.when)}</span> · ${htmlEsc(l.name)}</div>`).join('')}`
      : undefined,
    note: 'Dates slip: “no earlier than” is the soonest it could go.',
    links: [{ href: p.url, label: 'Launch Library 2' }],
  });
}
