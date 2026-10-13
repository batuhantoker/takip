import { pop } from '@/lib/map/popups/kit';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

export function gnssPopupHtml(p: Props): string {
  const pct = Math.round(Number(p.ratio) * 100);
  return pop({
    kicker: 'Likely GNSS interference',
    tone: 'amber',
    title: `${pct}% of aircraft degraded`,
    subtitle: `${Number(p.bad)} of ${Number(p.total)} airborne aircraft in this 2° cell, latest poll`,
    note: 'Inferred from ADS-B position accuracy (NACp ≤ 4), as gpsjam.org does. Avionics faults look the same, and it can’t tell jamming from spoofing or find the source.',
  });
}
