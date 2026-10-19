'use client';
/** TAKIP TI Assist: what TI put on screen: a list to click through, market quotes, or a forecast it started. */
import { useState } from 'react';
import { Cctv, CloudSun, FileText, Hourglass, Link2, List, MapPin, Plane, Route, Satellite, ScanSearch, Search, TrendingUp, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { useT } from '@/components/ui/use-t';
import type { AiClient } from '@/components/panels/ti-agent/use-ai';
import type { Card } from '@/lib/ai/assist/tools';
import { currentAnswer } from '@/lib/ai/state';
import { AiMark } from '../atoms';
import { Figures } from '@/components/panels/ti-agent/parts/figures';
import { phaseText, sentence } from '../theme';

const ICON: Record<Card['kind'], LucideIcon> = {
  find: Search, show: List, markets: TrendingUp, forecast: TrendingUp, place: MapPin, scan: ScanSearch, camera: Cctv,
  aircraft: Plane, weather: CloudSun, pass: Satellite, brief: FileText, route: Route, link: Link2, history: Hourglass,
};
const SHOWN = 6;

/** A place card only repeats the action row that flew there, which has its own Show. */
export const cardWorthShowing = (c: Card) => !(c.kind === 'place' && c.items.length <= 1);

export function ResultCard({ card, ai, onLocate, onOpenForecast, onWorkspace }: {
  card: Card; ai: AiClient; onLocate: (lat: number, lng: number, zoom?: number) => void; onOpenForecast: () => void; onWorkspace?: () => void;
}) {
  const t = useT();
  const [all, setAll] = useState(false);
  if (card.kind === 'forecast') return <ForecastCard card={card} ai={ai} onOpenForecast={onOpenForecast} onWorkspace={onWorkspace} />;
  const Icon = ICON[card.kind];
  const shown = all ? card.items : card.items.slice(0, SHOWN);
  const zoom = card.kind === 'place' ? undefined : card.kind === 'camera' ? 14 : 8;
  return (
    <section className="overflow-hidden rounded-card border border-line">
      <header className="flex min-h-9 items-center gap-2 border-b border-line px-3 py-2">
        <Icon aria-hidden className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} />
        <h4 className="min-w-0 flex-1 truncate text-small font-medium text-ink-1">{card.title}</h4>
        {card.subtitle && <span className="shrink-0 text-meta text-ink-3">{card.subtitle}</span>}
      </header>
      {card.items.length === 0 ? <p className="px-3 py-2.5 text-small text-ink-3">{t('Nothing matched.')}</p> : (
        <div className="flex flex-col p-1">
          {shown.map((it, i) => {
            const placed = it.lat !== undefined && it.lng !== undefined;
            const value = it.value
              ? <span className={cx('font-mono text-small whitespace-pre tabular-nums', it.tone === 'up' ? 'text-green' : it.tone === 'down' ? 'text-red' : 'text-ink-1')}>{it.value}</span>
              : undefined;
            return (
              <ListRow key={i} flush compact={!it.detail} title={it.label} subtitle={it.detail} trailing={value}
                onClick={placed ? () => onLocate(it.lat!, it.lng!, zoom) : undefined}
                href={!placed ? it.url : undefined} external={!placed && Boolean(it.url)}
                aria-label={placed ? t('Show {name} on the map', { name: it.label }) : undefined} />
            );
          })}
        </div>
      )}
      {card.items.length > SHOWN && (
        <div className="border-t border-line px-1 py-1">
          <Button variant="ghost" size="sm" onClick={() => setAll(v => !v)}>{all ? t('Show fewer') : t('Show all {n}', { n: card.items.length })}</Button>
        </div>
      )}
    </section>
  );
}

/** A forecast TI started: it follows the run and opens it in Forecast. */
function ForecastCard({ card, ai, onOpenForecast, onWorkspace }: { card: Card; ai: AiClient; onOpenForecast: () => void; onWorkspace?: () => void }) {
  const t = useT();
  const live = ai.runId === card.runId ? ai.state : null;
  const answer = live ? sentence(currentAnswer(live), t) : '';
  const status = !live ? '' : live.status === 'running' ? phaseText(t, live.phase, live.phaseLabel) : live.status === 'done' ? t('Ready') : live.status === 'failed' ? t('Failed') : t('Stopped');
  return (
    <section className="flex flex-col gap-2 rounded-card border border-gold/25 bg-gold-soft p-3">
      <div className="flex items-center gap-2 text-meta">
        <AiMark size={14} live={live?.status === 'running'} />
        <span className="font-medium text-gold">{t('Forecast')}</span>
        {status && <span className="min-w-0 truncate text-ink-3">{status}</span>}
      </div>
      <p className="text-body font-medium text-ink-1">{card.title}</p>
      {answer && <p className="text-title font-medium text-ink-1"><Figures text={answer} /></p>}
      <div className="mt-1 flex items-center gap-1">
        <Button size="sm" onClick={() => { if (card.runId && ai.runId !== card.runId) void ai.watch(card.runId); onOpenForecast(); }}>{t('Open forecast')}</Button>
        {onWorkspace && live && <Button size="sm" variant="ghost" onClick={onWorkspace}>{t('Open the workspace')}</Button>}
      </div>
    </section>
  );
}
