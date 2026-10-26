import { SERIES_INK } from '@/lib/map/style/tokens';
import type { AnswerTile } from '@/lib/platform/site/compare/compare-copy';

/** What a comparison was searched for, before any chart: both figures side by side, then who is higher, by how much and since when. */
export function PairAnswer({ tiles, verdict, since }: { tiles: AnswerTile[]; verdict?: string; since?: string }) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <dl className="grid max-w-[36rem] grid-cols-2 gap-3">
        {tiles.map(tile => (
          <div key={tile.slot} className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface-1 px-3.5 py-3">
            <dt className="flex items-center gap-2 text-[13px] text-ink-2">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: SERIES_INK[tile.slot] }} />
              <span className="truncate">{tile.name}</span>
            </dt>
            <dd className="text-[15px] leading-tight text-ink-2">
              {tile.before}
              <span className="text-[22px] font-semibold tracking-[-0.01em] text-ink-1 tabular-nums">{tile.number}</span>
              {tile.after}
            </dd>
            <dd className="text-[12px] text-ink-3">{tile.note}</dd>
          </div>
        ))}
      </dl>
      {(verdict || since) && (
        <p className="max-w-[44rem] text-[17px] leading-relaxed text-ink-2">
          {verdict && <span className="font-medium text-ink-1">{verdict}</span>}
          {verdict && since && ' '}
          {since}
        </p>
      )}
    </div>
  );
}
