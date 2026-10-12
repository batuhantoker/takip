import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec, type EventEntityRow, type MetricInput } from '@takip/db';
import { type Ctx, importDataset, type Publish, RAW } from '../context';
import { csvRecords, num, readCsv, text } from '../csv';
import { isoDate, utc } from '../dates';
import { anchor, EventBatch } from '../events';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

const DIR = join(RAW, 'Global Trade War 2018 - Present ');
const f = (name: string) => join(DIR, name);
const AS_OF = '2026-10-09';
/** The seed's eu27 region group has no point yet: Brussels. */
const EU_POINT = { lon: 4.35, lat: 50.85 };

const PX = ['open', 'high', 'low', 'close', 'volume'] as const;
const PX_METRICS: Record<(typeof PX)[number], MetricInput> = {
  // There is no 'first' agg; mean is the closest for an open price.
  open: { code: 'px:open', name: 'Open', granularity: 'day', agg: 'mean', topic: 'markets' },
  high: { code: 'px:high', name: 'High', granularity: 'day', agg: 'max', topic: 'markets' },
  low: { code: 'px:low', name: 'Low', granularity: 'day', agg: 'min', topic: 'markets' },
  close: { code: 'px:close', name: 'Close', granularity: 'day', agg: 'last', topic: 'markets' },
  volume: { code: 'px:volume', name: 'Volume', granularity: 'day', agg: 'sum', topic: 'markets' },
};
const FX: MetricInput = { code: 'fx:rate_vs_usd', name: 'Exchange rate, units per US dollar', unit: 'per USD', granularity: 'day', agg: 'last', topic: 'markets' };

const merge = (a: Publish, b: Publish): Publish => {
  const lo = [a.tLo, b.tLo].filter((t): t is number => t != null);
  const hi = [a.tHi, b.tHi].filter((t): t is number => t != null);
  return {
    tLo: lo.length ? Math.min(...lo) : null,
    tHi: hi.length ? Math.max(...hi) : null,
    layers: [...new Set([...(a.layers ?? []), ...(b.layers ?? [])])],
  };
};

export async function importTradewar(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'tradewar',
      version: AS_OF,
      asOf: AS_OF,
      files: [
        'tariff_timeline.csv',
        'trade_volume_annual.csv',
        'stock_market_reaction.csv',
        'sector_impact.csv',
        'currency_impact.csv',
        'inflation_response.csv',
        'column_metadata.csv',
      ].map(f),
      importerVersion: '1',
    },
    async ds => {
      const r = new Resolver(ctx);
      const rep = ds.report;
      const eu27 = r.key('region:eu27');

      /** ISO codes, or names and region groups (EU, Global, ALL). */
      const party = (v: string, t: number) => {
        const id = r.resolveAny([['iso3', v], ['iso2', v]], t) ?? r.byName(v, t);
        if (id === undefined) rep.miss(`party:${v}`);
        return id;
      };

      const batch = new EventBatch(ctx, ds);
      for (const row of await readCsv(f('tariff_timeline.csv'))) {
        rep.rows++;
        const d = isoDate(row.date);
        if (!d) {
          rep.reject('tariff_timeline: bad date', row.date);
          continue;
        }
        const imposing = party(row.imposing_country, d.t);
        const target = party(row.target_country, d.t);
        const entities: EventEntityRow[] = [];
        if (imposing !== undefined) entities.push({ entityId: imposing, role: 'imposing' });
        if (target !== undefined) entities.push({ entityId: target, role: 'targeted' });

        let at = anchor(r, null, null, GeoPrec.country, [imposing]);
        if (at.lon === null && imposing !== undefined && imposing === eu27) at = { ...EU_POINT, geoPrec: GeoPrec.country };

        const news = row.type === 'NewsAPI';
        const key = createHash('sha1')
          .update([row.date, row.imposing_country, row.target_country, row.sector, row.tariff_rate_pct].join('|'))
          .digest('hex');
        batch.add({
          kind: 'econ.tariff',
          sourceRecordId: key,
          title: text(row.notes) ?? `${row.imposing_country} tariff on ${row.target_country}: ${row.sector} ${row.tariff_rate_pct}%`,
          tStart: d.t,
          tStartPrec: d.prec,
          ...at,
          magnitude: num(row.estimated_trade_value_usd_bn),
          confidence: news ? 0.3 : 1,
          attrs: {
            imposing: row.imposing_country,
            target: row.target_country,
            sector: text(row.sector),
            rate_pct: num(row.tariff_rate_pct),
            prev_rate_pct: num(row.prev_rate_pct),
            type: text(row.type),
            legal_basis: text(row.legal_basis),
            trade_value_usd_bn: num(row.estimated_trade_value_usd_bn),
            retaliation: row.retaliation === 'True',
            publisher: text(row.source),
            ...(news ? { unverified: true } : {}),
          },
          entities,
        });
      }
      const events = batch.finish();

      const series = new SeriesBatch(ctx, ds);
      const sharedIds = new Map<string, number>();
      /** wdi:* and fred:* belong to their publishers' importers: create them when missing, never overwrite their definitions. */
      const shared = (m: MetricInput) => {
        let id = sharedIds.get(m.code);
        if (id === undefined) sharedIds.set(m.code, (id = ctx.series.metric(m.code)?.metricId ?? series.metric(m)));
        return id;
      };

      const setAttrs = ctx.catalog.prepare(`UPDATE core_entity SET attrs = ?, updated_at = ? WHERE entity_id = ? AND attrs IS NOT ?`);
      const instruments = new Map<string, number>();
      const instrument = (scheme: string, value: string, name: string, attrs: Record<string, unknown>) => {
        const k = `${scheme}|${value}`;
        let id = instruments.get(k);
        if (id === undefined) {
          id = r.ensure('instrument', scheme, value, name, ds.sourceId);
          // ensure() only takes attrs together with a point, and instruments have none.
          const json = JSON.stringify(attrs);
          setAttrs.run(json, Date.now(), id, json);
          instruments.set(k, id);
        }
        return id;
      };
      // VNM is also a US-listed ETF's ticker.
      const ticker = (t: string): [string, string] => (t === 'VNM' ? ['native:tradewar', 'VNINDEX'] : ['ticker', t]);

      for (const row of await readCsv(f('trade_volume_annual.csv'))) {
        rep.rows++;
        const year = num(row.year);
        if (year === null) {
          rep.reject('trade_volume_annual: bad year', row.year);
          continue;
        }
        const t = utc(year);
        const subject = r.resolve('iso2', row.country_code, t) ?? r.byName(row.country, t);
        if (subject === undefined) {
          rep.miss(`iso2:${row.country_code} ${row.country}`);
          continue;
        }
        const metric = shared({ code: `wdi:${row.indicator}`, name: row.indicator_name, granularity: 'year', agg: 'mean' });
        series.add(metric, 'entity', subject, { t, v: num(row.value), prec: Prec.year });
      }
      series.flush();

      const px = Object.fromEntries(PX.map(k => [k, series.metric(PX_METRICS[k])])) as Record<(typeof PX)[number], number>;
      const prices = async (file: string, subject: (row: Record<string, string>) => number) => {
        for await (const row of csvRecords(f(file))) {
          if (row.__header__) continue;
          rep.rows++;
          const d = isoDate(row.date);
          if (!d) {
            rep.reject(`${file}: bad date`, row.date);
            continue;
          }
          const id = subject(row);
          for (const k of PX) series.add(px[k], 'entity', id, { t: d.t, v: num(row[k]), prec: d.prec });
        }
        series.flush();
      };
      await prices('stock_market_reaction.csv', row => instrument(...ticker(row.ticker), row.index_name, { country: text(row.country) }));
      await prices('sector_impact.csv', row =>
        instrument(...ticker(row.ticker), row.sector_label, { country: text(row.country), sector: text(row.sector), tariff_sensitivity: text(row.tariff_sensitivity) }),
      );

      const fx = series.metric(FX);
      for await (const row of csvRecords(f('currency_impact.csv'))) {
        if (row.__header__) continue;
        rep.rows++;
        const d = isoDate(row.date);
        if (!d) {
          rep.reject('currency_impact: bad date', row.date);
          continue;
        }
        const id = instrument('iso4217', row.currency, row.currency, { country: text(row.country) });
        series.add(fx, 'entity', id, { t: d.t, v: num(row.rate_vs_usd), prec: d.prec });
      }
      series.flush();

      for (const row of await readCsv(f('inflation_response.csv'))) {
        rep.rows++;
        const d = isoDate(row.date.slice(0, 7));
        if (!d) {
          rep.reject('inflation_response: bad date', row.date);
          continue;
        }
        const subject = party(row.country, d.t);
        if (subject === undefined) continue;
        const metric = shared({
          code: `fred:${row.fred_series}`,
          name: `${row.metric}: ${row.category}`,
          granularity: 'month',
          agg: 'mean',
          topic: 'econ',
          attrs: { label: row.series_label },
        });
        series.add(metric, 'entity', subject, { t: d.t, v: num(row.value), prec: d.prec });
      }

      rep.extra.column_metadata = await readCsv(f('column_metadata.csv'));
      return merge(events, series.finish());
    },
  );
}
