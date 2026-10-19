import { activeIntl, t } from '@/lib/core/i18n/active';
import { msg } from '@/lib/core/i18n/translator';
import { htmlEsc, pop } from '@/lib/map/popups/kit';
import { categoryColor, sigmetColor } from './layers';
import { changeText, flightLevel, sigmetTitle } from './sigmet';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const CATEGORY_TEXT: Record<string, string> = {
  VFR: msg('Visual flight rules: ceiling above 3,000 ft and visibility over 5 mi'),
  MVFR: msg('Marginal VFR: ceiling 1,000–3,000 ft or visibility 3–5 mi'),
  IFR: msg('Instrument flight rules: ceiling 500–1,000 ft or visibility 1–3 mi'),
  LIFR: msg('Low IFR: ceiling below 500 ft or visibility under 1 mi'),
};

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const utc = (iso: unknown) => {
  const d = new Date(String(iso ?? ''));
  return Number.isNaN(d.getTime()) ? undefined : `${d.toISOString().slice(11, 16)} UTC`;
};
const minutesAgo = (iso: unknown) => {
  const ms = Date.parse(String(iso ?? ''));
  return Number.isFinite(ms) ? Math.max(0, Math.round((Date.now() - ms) / 60_000)) : undefined;
};

/** "270° 12 kt, gusts 25", "Calm". */
export function windText(p: Props): string | undefined {
  const kt = num(p.windKt), dir = num(p.windDir), gust = num(p.gustKt);
  if (kt == null) return undefined;
  if (kt === 0) return t('Calm');
  const from = dir ? `${String(dir).padStart(3, '0')}°` : t('Variable');
  return gust ? t('{from} {kt} kt, gusts {gust}', { from, kt, gust }) : `${from} ${kt} kt`;
}

export function airportWxPopupHtml(p: Props): string {
  const cat = p.cat ? String(p.cat) : undefined;
  const temp = num(p.tempC), dew = num(p.dewC), ceiling = num(p.ceilingFt), ago = minutesAgo(p.at);
  return pop({
    kicker: t('Airport weather'),
    dot: categoryColor(cat),
    meta: ago == null ? undefined : t('{n} min ago', { n: ago }),
    title: p.id == null ? t('Station') : String(p.id),
    subtitle: cat ? (CATEGORY_TEXT[cat] ? t(CATEGORY_TEXT[cat]) : undefined) : t('No flight category reported'),
    rows: [
      { label: t('Wind'), value: windText(p) },
      { label: t('Visibility'), value: p.visSm ? `${p.visSm} mi` : undefined },
      { label: t('Ceiling'), value: ceiling == null ? undefined : `${ceiling.toLocaleString(activeIntl())} ft` },
      { label: t('Weather'), value: p.wx ? String(p.wx) : undefined, mono: true },
      { label: t('Temp / dew'), value: temp == null ? undefined : `${temp}° / ${dew ?? '—'}° C` },
      { label: t('Observed'), value: utc(p.at), mono: true },
    ],
    body: p.raw ? `<div class="tk-mono">${htmlEsc(p.raw)}</div>` : undefined,
    links: [{ href: `https://aviationweather.gov/data/metar/?id=${encodeURIComponent(String(p.id ?? ''))}&hours=6&decoded=1`, label: 'aviationweather.gov' }],
  });
}

export function sigmetPopupHtml(p: Props): string {
  const base = num(p.baseFt), top = num(p.topFt);
  const levels = top == null ? undefined : base == null
    ? t('Up to {top}', { top: flightLevel(top) })
    : t('{base} to {top}', { base: flightLevel(base), top: flightLevel(top) });
  return pop({
    kicker: 'SIGMET',
    dot: sigmetColor(p.hazard),
    meta: p.fir ? String(p.fir) : undefined,
    title: sigmetTitle(String(p.hazard ?? ''), p.qualifier ? String(p.qualifier) : undefined, t),
    subtitle: p.firName ? t('{fir} flight information region', { fir: String(p.firName) }) : undefined,
    rows: [
      { label: t('Levels'), value: levels, mono: true },
      { label: t('Moving'), value: p.move === 'Stationary' ? t('Stationary') : p.move ? String(p.move) : undefined },
      { label: t('Trend'), value: changeText(p.change ? String(p.change) : undefined, t) },
      { label: t('Valid'), value: [utc(p.from), utc(p.to)].every(Boolean) ? t('{from} to {to}', { from: utc(p.from)!, to: utc(p.to)! }) : undefined, mono: true },
    ],
    body: p.raw ? `<div class="tk-mono">${htmlEsc(p.raw)}</div>` : undefined,
    links: [{ href: 'https://aviationweather.gov/gfa/#sigmet', label: 'aviationweather.gov' }],
    wide: true,
  });
}
