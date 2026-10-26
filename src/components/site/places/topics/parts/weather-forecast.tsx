import { Cloud, CloudFog, CloudHail, CloudLightning, CloudMoon, CloudRain, CloudRainWind, CloudSnow, CloudSun, Moon, Snowflake, Sun, type LucideIcon } from 'lucide-react';
import { Section } from '@/components/site/pages/site-parts';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { MET_CREDIT } from '@/lib/feeds/weather/forecast';
import { wordingFor } from '@/lib/platform/site/places/copy/wording';
import { compass, precipitationIn, skyOf, skyWords, temperatureIn, unitsFor, windSpeedIn, type Sky, type WeatherUnits } from '@/lib/platform/site/places/copy/weather-words';
import type { CityForecast } from '@/lib/platform/site/places/topics/weather-forecast';

const ICONS: Record<Sky, [LucideIcon, LucideIcon]> = {
  clear: [Sun, Moon], fair: [CloudSun, CloudMoon], partly: [CloudSun, CloudMoon], cloudy: [Cloud, Cloud], fog: [CloudFog, CloudFog],
  lightrain: [CloudRain, CloudRain], rain: [CloudRain, CloudRain], heavyrain: [CloudRainWind, CloudRainWind], sleet: [CloudHail, CloudHail],
  lightsnow: [CloudSnow, CloudSnow], snow: [CloudSnow, CloudSnow], heavysnow: [Snowflake, Snowflake], thunder: [CloudLightning, CloudLightning],
};

function SkyIcon({ symbol, t }: { symbol: string | null; t: Translate }) {
  const s = skyOf(symbol);
  if (!s) return <span className="size-6" />;
  const Icon = ICONS[s.sky][s.night ? 1 : 0];
  return <Icon className="size-6 text-ink-2" strokeWidth={1.5} role="img" aria-label={skyWords(s.sky, t)} />;
}

const rain = (mm: number | null, u: WeatherUnits, t: Translate) =>
  mm == null ? '' : mm < 0.05 ? '–' : precipitationIn(mm, u, t);

const nextDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

const OUTLOOK = [
  msg('{sky} in {city} {when, select, today {today} tomorrow {tomorrow} other {on {day}}}: between {low} and {high}, {wet, select, yes {{rain} of rain} other {dry}}, wind up to {wind}.'),
  msg('{sky} for {city} {when, select, today {today} tomorrow {tomorrow} other {on {day}}}, with temperatures from {low} to {high}, {wet, select, yes {{rain} of rain} other {no rain}} and wind up to {wind}.'),
  msg('{city} {when, select, today {today} tomorrow {tomorrow} other {on {day}}}: {low} to {high}. {sky}{wet, select, yes {, {rain} in all} other {, staying dry}}, wind up to {wind}.'),
];
const TREND = [
  msg('{day} turns {trend, select, warmer {warmer} other {cooler}}, with a high of {high}.'),
  msg('{trend, select, warmer {Warmer} other {Cooler}} on {day}, up to {high}.'),
];
/** Degrees between one day's high and the next's before the change is worth a sentence. */
const TREND_C = 3;

const weekday = (date: string, t: Translate) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(t.intl, { weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
};

/**
 * The table's first day as a sentence, and the next day's turn when it is a real one, so the forecast reads without
 * the table and a search result can quote it. `seed` (the place) picks the wording, so neighbouring pages differ.
 */
function Outlook({ t, city, forecast, u, seed }: { t: Translate; city: string; forecast: CityForecast; u: WeatherUnits; seed: string }) {
  const [d, next] = forecast.days;
  const sky = d && skyOf(d.symbol);
  if (!d || !sky || !city) return null;
  const turn = next && Math.abs(next.maxC - d.maxC) >= TREND_C ? (next.maxC > d.maxC ? 'warmer' : 'cooler') : null;
  return (
    <p className="mb-4 text-[15px] leading-relaxed text-ink-1">
      {t(OUTLOOK[wordingFor(`${seed}:outlook`, OUTLOOK.length)], {
        sky: skyWords(sky.sky, t), city,
        when: d.date === forecast.today ? 'today' : d.date === nextDate(forecast.today) ? 'tomorrow' : 'other',
        day: weekday(d.date, t),
        low: temperatureIn(d.minC, u, t), high: temperatureIn(d.maxC, u, t),
        wet: d.precipMm >= 0.05 ? 'yes' : 'no', rain: precipitationIn(d.precipMm, u, t), wind: windSpeedIn(d.windMaxMs, u, t),
      })}
      {turn && ` ${t(TREND[wordingFor(`${seed}:trend`, TREND.length)], { day: weekday(next.date, t), trend: turn, high: temperatureIn(next.maxC, u, t) })}`}
    </p>
  );
}

/** MET Norway's forecast for the place: the next day every three hours, then a line a day. */
export function WeatherForecast({ t, city, cc, forecast, title, place, seed = '' }: {
  t: Translate; city: string; cc: string; forecast: CityForecast; title?: string;
  /** For the opening sentence: the place with its country or state, and what picks its wording. */
  place?: string; seed?: string;
}) {
  const u = unitsFor(cc);
  const day = new Intl.DateTimeFormat(t.intl, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const updated = forecast.updated && new Intl.DateTimeFormat(t.intl, { hour: '2-digit', minute: '2-digit', timeZone: forecast.tz, timeZoneName: 'short' }).format(Date.parse(forecast.updated));
  const hour = new Intl.DateTimeFormat(t.intl, { hour: 'numeric', minute: '2-digit', timeZone: forecast.tz });
  return (
    <Section title={title ?? t('{city} weather forecast', { city })}>
      <Outlook t={t} city={place ?? city} forecast={forecast} u={u} seed={seed} />
      {forecast.hours.length > 0 && (
        <div className="-mx-1 overflow-x-auto px-1">
          <ol className="grid min-w-[36rem] grid-cols-8 gap-2">
            {forecast.hours.map(h => (
              <li key={h.t} className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface-1 px-1 py-3 text-center">
                <span className="text-[12px] text-ink-3 tabular-nums">{hour.format(h.t)}</span>
                <SkyIcon symbol={h.symbol} t={t} />
                <span className="text-[16px] font-semibold text-ink-1 tabular-nums">{temperatureIn(h.tempC, u, t)}</span>
                <span className="text-[12px] leading-tight text-ink-2 tabular-nums">{compass(h.windDir, t)} {windSpeedIn(h.windMs, u, t)}</span>
                <span className="text-[12px] text-ink-3 tabular-nums">{rain(h.precipMm, u, t)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {forecast.days.length > 0 && (
        <table className="mt-6 w-full border-collapse text-[14px]">
          <caption className="sr-only">{title ?? t('{city} weather forecast', { city })}</caption>
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-3">
              <th scope="col" className="py-2 pr-3 font-normal">{t('Day')}</th>
              <th scope="col" className="py-2 pr-3 font-normal"><span className="sr-only">{t('Sky')}</span></th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">{t('High / low')}</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">{t('Rain')}</th>
              <th scope="col" className="py-2 text-right font-normal">{t('Wind up to')}</th>
            </tr>
          </thead>
          <tbody>
            {forecast.days.map(d => {
              const [y, m, dd] = d.date.split('-').map(Number);
              const sky = skyOf(d.symbol);
              return (
                <tr key={d.date} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink-1">{d.date === forecast.today ? t('Today') : day.format(Date.UTC(y, m - 1, dd))}</th>
                  <td className="py-2.5 pr-3 text-ink-2">
                    <span className="flex items-center gap-2"><SkyIcon symbol={d.symbol} t={t} /><span className="hidden sm:inline">{sky ? skyWords(sky.sky, t) : ''}</span></span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-ink-1">{temperatureIn(d.maxC, u, t)} <span className="text-ink-3">/ {temperatureIn(d.minC, u, t)}</span></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">{rain(d.precipMm, u, t)}</td>
                  <td className="py-2.5 text-right tabular-nums text-ink-2">{windSpeedIn(d.windMaxMs, u, t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[13px] text-ink-3">
        {updated
          ? t('Forecast by {source} (CC BY 4.0), updated {time}. Times are local.', { source: MET_CREDIT, time: updated })
          : t('Forecast by {source} (CC BY 4.0). Times are local.', { source: MET_CREDIT })}
      </p>
    </Section>
  );
}
