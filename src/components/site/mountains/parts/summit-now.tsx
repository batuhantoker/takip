import { msg, type Translate } from '@/lib/core/i18n/translator';
import { compass, skyOf, skyWords, temperatureIn, unitsFor, windSpeedIn } from '@/lib/platform/site/places/copy/weather-words';
import type { CityForecast } from '@/lib/platform/site/places/topics/weather-forecast';

const FORECAST_FOR = msg('At the summit · forecast for {time}');

/** The forecast's first hour at the summit, in the summit's own time as the table under it: a forecast, and labelled as one. */
export function SummitNow({ t, forecast, cc, className = '' }: { t: Translate; forecast: CityForecast; cc: string; className?: string }) {
  const h = forecast.hours[0];
  if (!h) return null;
  const u = unitsFor(cc);
  const sky = skyOf(h.symbol);
  return (
    <div className={`rounded-card border border-line bg-surface-1 p-4 ${className}`}>
      <p className="text-[12px] font-medium text-ink-3">
        {t(FORECAST_FOR, { time: new Intl.DateTimeFormat(t.intl, { hour: 'numeric', minute: '2-digit', timeZone: forecast.tz }).format(h.t) })}
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold text-ink-1 tabular-nums">{temperatureIn(h.tempC, u, t)}</span>
        <span className="text-[15px] text-ink-2">
          {[sky && skyWords(sky.sky, t), t('wind {speed} from the {direction}', { speed: windSpeedIn(h.windMs, u, t), direction: compass(h.windDir, t) })].filter(Boolean).join(' · ')}
        </span>
      </p>
    </div>
  );
}
