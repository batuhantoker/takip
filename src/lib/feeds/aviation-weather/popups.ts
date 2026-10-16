import { htmlEsc, pop } from '@/lib/map/popups/kit';
import { categoryColor, sigmetColor } from './layers';
import { changeText, flightLevel, sigmetTitle } from './sigmet';

type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const CATEGORY_TEXT: Record<string, string> = {
  VFR: 'Visual flight rules: ceiling above 3,000 ft and visibility over 5 mi',
  MVFR: 'Marginal VFR: ceiling 1,000–3,000 ft or visibility 3–5 mi',
  IFR: 'Instrument flight rules: ceiling 500–1,000 ft or visibility 1–3 mi',
  LIFR: 'Low IFR: ceiling below 500 ft or visibility under 1 mi',
};

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const utc = (iso: unknown) => {
  const d = new Date(String(iso ?? ''));
  return Number.isNaN(d.getTime()) ? undefined : `${d.toISOString().slice(11, 16)} UTC`;
};
const minutesAgo = (iso: unknown) => {
  const t = Date.parse(String(iso ?? ''));
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60_000)) : undefined;
};

/** "270° 12 kt, gusts 25", "Calm". */
export function windText(p: Props): string | undefined {
  const kt = num(p.windKt), dir = num(p.windDir), gust = num(p.gustKt);
  if (kt == null) return undefined;
  if (kt === 0) return 'Calm';
  const from = dir ? `${String(dir).padStart(3, '0')}°` : 'Variable';
  return `${from} ${kt} kt${gust ? `, gusts ${gust}` : ''}`;
}

export function airportWxPopupHtml(p: Props): string {
  const cat = p.cat ? String(p.cat) : undefined;
  const temp = num(p.tempC), dew = num(p.dewC), ceiling = num(p.ceilingFt), ago = minutesAgo(p.at);
  return pop({
    kicker: 'Airport weather',
    dot: categoryColor(cat),
    meta: ago == null ? undefined : `${ago} min ago`,
    title: String(p.id ?? 'Station'),
    subtitle: cat ? CATEGORY_TEXT[cat] : 'No flight category reported',
    rows: [
      { label: 'Wind', value: windText(p) },
      { label: 'Visibility', value: p.visSm ? `${p.visSm} mi` : undefined },
      { label: 'Ceiling', value: ceiling == null ? undefined : `${ceiling.toLocaleString()} ft` },
      { label: 'Weather', value: p.wx ? String(p.wx) : undefined, mono: true },
      { label: 'Temp / dew', value: temp == null ? undefined : `${temp}° / ${dew ?? '—'}° C` },
      { label: 'Observed', value: utc(p.at), mono: true },
    ],
    body: p.raw ? `<div class="tk-mono">${htmlEsc(p.raw)}</div>` : undefined,
    links: [{ href: `https://aviationweather.gov/data/metar/?id=${encodeURIComponent(String(p.id ?? ''))}&hours=6&decoded=1`, label: 'aviationweather.gov' }],
  });
}

export function sigmetPopupHtml(p: Props): string {
  const base = num(p.baseFt), top = num(p.topFt);
  const levels = top == null ? undefined : base == null ? `Up to ${flightLevel(top)}` : `${flightLevel(base)} to ${flightLevel(top)}`;
  return pop({
    kicker: 'SIGMET',
    dot: sigmetColor(p.hazard),
    meta: p.fir ? String(p.fir) : undefined,
    title: sigmetTitle(String(p.hazard ?? ''), p.qualifier ? String(p.qualifier) : undefined),
    subtitle: p.firName ? `${p.firName} flight information region` : undefined,
    rows: [
      { label: 'Levels', value: levels, mono: true },
      { label: 'Moving', value: p.move ? String(p.move) : undefined },
      { label: 'Trend', value: changeText(p.change ? String(p.change) : undefined) },
      { label: 'Valid', value: [utc(p.from), utc(p.to)].every(Boolean) ? `${utc(p.from)} to ${utc(p.to)}` : undefined, mono: true },
    ],
    body: p.raw ? `<div class="tk-mono">${htmlEsc(p.raw)}</div>` : undefined,
    links: [{ href: 'https://aviationweather.gov/gfa/#sigmet', label: 'aviationweather.gov' }],
    wide: true,
  });
}
