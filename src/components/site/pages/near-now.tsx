'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { LocateFixed } from 'lucide-react';
import Link from 'next/link';
import { WeatherForecast } from '@/components/site/places/topics/parts/weather-forecast';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { conditionsForYou, lightningForYou, rainForYou, type WeatherNowAnswer } from '@/lib/platform/site/live/weather-now';
import { localePath } from '@/lib/platform/site/locale-path';
import { browserTimeZone, locateVisitor, type VisitorPoint } from '@/lib/places/ip-location/browser';
import { LocalClock } from './local-clock';
import { TEXT_LINK } from './site-frame';

export type NearKind = 'lightning' | 'rain' | 'weather';

const AS_OF = msg('Right now · as of {time}');
const CHECKING: Record<NearKind, string> = {
  lightning: msg('Checking for lightning near you…'), rain: msg('Checking the radar near you…'), weather: msg('Checking the weather near you…'),
};
const QUESTION: Record<NearKind, string> = {
  lightning: msg('Is there lightning near me right now?'), rain: msg('Is it raining near me right now?'), weather: msg('What’s the weather near me right now?'),
};

type State =
  | { step: 'locating' | 'unknown' | 'failed' }
  | { step: 'checking' | 'done'; at: VisitorPoint; answer?: WeatherNowAnswer };

interface Near { kind: NearKind; state: State; denied: boolean; exact(): void }

const NearContext = createContext<Near | null>(null);

/**
 * Where the visitor is, by their connection (or their device, once they allow it), checked through /api/weather-now:
 * shared by the box under a page's heading and, on the weather page, the forecast further down.
 */
export function NearProvider({ kind, children }: { kind: NearKind; children: ReactNode }) {
  const t = useT();
  const [state, setState] = useState<State>({ step: 'locating' });
  const [denied, setDenied] = useState(false);

  const check = useCallback(async (at: VisitorPoint, signal?: AbortSignal) => {
    setState({ step: 'checking', at });
    const tz = browserTimeZone();
    const detail = kind === 'weather' ? `&detail=1${tz ? `&tz=${encodeURIComponent(tz)}` : ''}` : '';
    try {
      const res = await fetch(`/api/weather-now?lat=${at.lat}&lon=${at.lng}&lang=${t.locale}${detail}`, { signal });
      if (!res.ok) throw new Error(String(res.status));
      setState({ step: 'done', at, answer: await res.json() as WeatherNowAnswer });
    } catch {
      if (!signal?.aborted) setState({ step: 'failed' });
    }
  }, [t.locale, kind]);

  useEffect(() => {
    const ctrl = new AbortController();
    locateVisitor(ctrl.signal).then(at => {
      if (ctrl.signal.aborted) return;
      if (at) void check(at, ctrl.signal);
      else setState({ step: 'unknown' });
    });
    return () => ctrl.abort();
  }, [check]);

  const exact = () => navigator.geolocation?.getCurrentPosition(
    fix => void check({ lat: fix.coords.latitude, lng: fix.coords.longitude, via: 'device' }),
    () => setDenied(true),
    { timeout: 10_000, maximumAge: 5 * 60_000 },
  );

  return <NearContext value={{ kind, state, denied, exact }}>{children}</NearContext>;
}

/** Is there lightning, or rain, near me right now; or, on the weather page, what it is like. */
export function NearNow({ className }: { className?: string }) {
  const t = useT();
  const near = useContext(NearContext);
  if (!near) return null;
  const { kind, state, denied, exact } = near;

  const answer = state.step === 'done' ? state.answer : undefined;
  const cc = answer?.place?.cc ?? '';
  const lightning = answer && lightningForYou(answer.lightning, cc, t);
  const rain = answer && rainForYou(answer.rain, cc, t);
  const lines = (kind === 'lightning' ? [lightning, rain] : kind === 'rain' ? [rain, lightning] : [answer && conditionsForYou(answer, t), rain, lightning])
    .filter(l => !!l);
  const timeOf = (k: 'lightning' | 'rain') => { const v = answer?.[k]; return v?.covered ? v.at : null; };
  const at = kind === 'lightning' ? timeOf('lightning') : timeOf('rain') ?? (kind === 'weather' ? timeOf('lightning') : null);

  let body: ReactNode;
  if (state.step === 'locating' || state.step === 'checking') body = <p className="text-ink-2">{t(CHECKING[kind])}</p>;
  else if (state.step === 'unknown') body = <p className="text-ink-2">{t('Your connection doesn’t say where you are.')}</p>;
  else if (state.step === 'failed' || !lines.length) body = <p className="text-ink-2">{t('The lightning networks and the radar couldn’t be read just now.')}</p>;
  else body = lines.map((line, i) => <p key={i} className={i ? 'text-[14px] text-ink-2' : undefined}>{line}</p>);

  const from = state.step === 'checking' || state.step === 'done' ? state.at.via : undefined;
  return (
    <section className={cx('rounded-card border border-line bg-surface-1 p-4', className)} aria-live="polite">
      <h2 className="text-[16px] font-semibold text-ink-1">{t(QUESTION[kind])}</h2>
      <p className="mt-1 flex items-center gap-2 text-[12px] font-medium text-ink-3">
        <span className={cx('size-1.5 rounded-full', at ? 'bg-green' : 'bg-ink-3')} aria-hidden />
        {at ? <span>{t.parts(AS_OF, { time: <LocalClock key="t" at={at} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]}</span>
          : <span>{t('Near you')}</span>}
      </p>
      <div className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-1">{body}</div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
        {answer?.place && (from === 'device'
          ? <span>{t('At your location, near {city}.', { city: answer.place.name })}</span>
          : <span>{t('Near {city}, as your connection places you.', { city: answer.place.name })}</span>)}
        {from !== 'device' && state.step !== 'locating' && state.step !== 'checking' && !denied && (
          <button type="button" onClick={exact} className={cx('inline-flex items-center gap-1 text-ink-1 hover:text-accent', FOCUS_RING)}>
            <LocateFixed className="size-3.5" aria-hidden />{t('Use my exact location')}
          </button>
        )}
        {denied && <span>{t('Location access was declined.')}</span>}
        {answer?.place && (
          <Link href={localePath(t.locale, answer.place.path)} className={TEXT_LINK}>
            {t('Weather in {city}: forecast and live map', { city: answer.place.name })}
          </Link>
        )}
      </p>
    </section>
  );
}

/** MET Norway's forecast for where the visitor is, once the box has found them. */
export function NearForecast() {
  const t = useT();
  const near = useContext(NearContext);
  const answer = near?.state.step === 'done' ? near.state.answer : undefined;
  if (!answer?.forecast) return null;
  return (
    <WeatherForecast t={t} city={answer.place?.name ?? ''} cc={answer.place?.cc ?? ''} forecast={answer.forecast}
      title={t('The forecast where you are')} />
  );
}
