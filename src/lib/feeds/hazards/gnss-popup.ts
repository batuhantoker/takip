import { t } from '@/lib/core/i18n/active';
import { pop } from '@/lib/map/popups/kit';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

export function gnssPopupHtml(p: Props): string {
  const pct = Math.round(Number(p.ratio) * 100);
  return pop({
    kicker: t('Likely GNSS interference'),
    tone: 'amber',
    title: t('{pct}% of aircraft degraded', { pct }),
    subtitle: t('{bad} of {total} airborne aircraft in this 2° cell, latest poll', { bad: Number(p.bad), total: Number(p.total) }),
    note: t('Inferred from ADS-B position accuracy (NACp ≤ 4), as gpsjam.org does. Avionics faults look the same, and it can’t tell jamming from spoofing or find the source.'),
  });
}
