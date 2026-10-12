import { writeControl } from '@takip/archive/control';
import { Recorder } from '@takip/archive/recorder';
import { DAY_MS, floorTo, HOUR_MS } from '@takip/core/time';
import { LODS } from '@takip/core/tracks';
import { openIngest } from './context';
import { ingestEnv, loadEnvFiles } from './env';
import { backfillDay, HISTORY_SOURCE } from './backfill/adsblol-history';
import { backfillOpenSky } from './backfill/opensky';
import { backfillUsgs } from './backfill/usgs';
import { MIN_MAG } from './connectors/usgs';
import { buildLod } from './jobs/build-lod';
import { ingestEventHours } from './jobs/ingest-events';
import { ingestTleHour } from './jobs/ingest-tle';
import { sealOrQueue } from './jobs/seal-hours';
import { runWorker } from './worker';

const USAGE = `npm run ingest -- <command>

  worker                         seal, build LODs and load TLEs as data arrives (one per data dir)
  seal <from> [to]               seal L0 hours in [from, to); ignores the 2 h delay, so it works on open hours
  rebuild <from> [to]            seal L0 hours again, then rebuild the L1/L2 buckets that contain them
                                 (both hand the hours to the worker when one is running)
  backfill adsblol-history <day> [last day]
                                 stream adsb.lol's published history for whole UTC days (~3 GB each, ODbL)
  backfill opensky <from> [to]   past state vectors, up to 1 h back; needs an OpenSky account
  backfill usgs <from> [to] [min magnitude]
                                 USGS earthquakes since 1900 into history.db (default M2.5; to defaults to now)
  lod <1|2> <from> [to]          build L1 or L2 buckets
  tle <from> [to]                load archived CelesTrak hours into tracks/tle.db
  sources                        list sources and their record/build switches
  source <code> <record|build> <on|off>   switch one (the admin console does the same)
  status                         sealed buckets and coverage for the last day

  Times: ISO in UTC (2026-10-12T13, 2026-10-12T13:30Z) or relative to now (now, -3h, -2d).`;

function parseTime(arg: string, now: number): number {
  const rel = /^(now)?([+-]\d+)([hd])$/.exec(arg);
  if (arg === 'now') return now;
  if (rel) return now + Number(rel[2]) * (rel[3] === 'h' ? HOUR_MS : DAY_MS);
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(arg) ? `${arg}:00Z` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(arg) ? arg : `${arg}Z`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`not a time: ${arg}`);
  return t;
}

function range(args: string[], size: number, now: number): number[] {
  const from = floorTo(parseTime(args[0] ?? '', now), size);
  const to = args[1] ? parseTime(args[1], now) : from + size;
  const out: number[] = [];
  for (let t = from; t < to; t += size) out.push(t);
  return out;
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 16);

function report(r: Awaited<ReturnType<typeof sealOrQueue>>) {
  if (r.queued) {
    console.log(`the ingest worker is running: queued ${r.queued} hours for it to seal (about 6 a minute)`);
    return;
  }
  for (const s of r.sealed) {
    console.log(`L0 ${iso(s.hour)}  ${s.entities} entities  ${s.segments} segments  ${s.points} points  ${JSON.stringify(s.coverage)}`);
  }
  for (const b of r.built) console.log(`L${b.lod} ${iso(b.bucket)}  ${b.segments} segments  ${b.points} points`);
}

async function main([command, ...args]: string[]) {
  loadEnvFiles();
  const env = ingestEnv();
  if (command === 'worker') return runWorker(openIngest(env), { webUrl: env.webUrl });

  const ctx = openIngest(env);
  const now = ctx.now();
  try {
    switch (command) {
      case 'seal':
      case 'rebuild':
        return report(await sealOrQueue(ctx, range(args, HOUR_MS, now), command, { lods: command === 'rebuild' }));
      case 'backfill': {
        const [source, ...rest] = args;
        if (source === HISTORY_SOURCE) {
          const days = range(rest, DAY_MS, now);
          if (!rest[0]) throw new Error('name the day(s) to backfill, e.g. backfill adsblol-history 2026-10-11');
          const hours: number[] = [];
          for (const day of days) {
            const r = await backfillDay(ctx.archiveDir, new Date(day).toISOString().slice(0, 10), { log: m => console.log(m) });
            console.log(`${r.tag}: ${r.aircraft} aircraft, ${r.points} points in ${r.hours.length} hours`);
            hours.push(...r.hours);
          }
          return report(await sealOrQueue(ctx, [...new Set(hours)].sort((a, b) => a - b), `backfill ${HISTORY_SOURCE}`, { lods: true }));
        }
        if (source === 'opensky') {
          const from = parseTime(rest[0] ?? '-1h', now);
          const r = await backfillOpenSky(ctx.archiveDir, from, rest[1] ? parseTime(rest[1], now) : now, { log: m => console.log(m) });
          console.log(`OpenSky: ${r.calls} calls`);
          return report(await sealOrQueue(ctx, r.hours, 'backfill opensky', { lods: true }));
        }
        if (source === 'usgs') {
          if (!rest[0]) throw new Error('name the start, e.g. backfill usgs 2026-01-01 (M2.5+ is a few thousand quakes a month)');
          const minMag = rest[2] ? Number(rest[2]) : MIN_MAG;
          if (!Number.isFinite(minMag)) throw new Error(`not a magnitude: ${rest[2]}`);
          if (!ctx.catalog.source('usgs')?.record) throw new Error('usgs recording is switched off; the archive would drop every answer');
          const rec = new Recorder({ dir: ctx.archiveDir, log: m => console.log(m) });
          const r = await backfillUsgs(rec, parseTime(rest[0], now), rest[1] ? parseTime(rest[1], now) : now, { minMag, log: m => console.log(m) });
          await rec.close();
          const loaded = await ingestEventHours(ctx, 'usgs', r.hours);
          console.log(`USGS: ${r.calls} requests; ${loaded ? `${loaded.inserted} new and ${loaded.changed} revised quakes of ${loaded.records}` : 'usgs is switched off (build)'}`);
          if (r.failed) process.exitCode = 1;
          return;
        }
        throw new Error(`no backfill for ${source ?? '(none)'}: adsblol-history, opensky and usgs have one (replay-database.md §7.7)`);
      }
      case 'lod': {
        const lod = Number(args[0]);
        if (lod !== 1 && lod !== 2) throw new Error('lod must be 1 or 2');
        for (const bucket of range(args.slice(1), LODS[lod].bucketMs, now)) {
          const r = buildLod(ctx, lod, bucket);
          console.log(`L${lod} ${iso(bucket)}  ${r.segments} segments  ${r.points} points`);
        }
        return;
      }
      case 'tle': {
        for (const hour of range(args, HOUR_MS, now)) {
          const r = await ingestTleHour(ctx, hour);
          console.log(r ? `TLE ${iso(hour)}  ${r.inserted} new of ${r.records}` : 'celestrak is switched off (build)');
        }
        return;
      }
      case 'sources': {
        for (const s of ctx.catalog.sources()) {
          const by = s.switchedBy ? `  (${s.switchedBy}, ${iso(s.switchedAt!)})` : '';
          console.log(`${s.code.padEnd(12)} record ${s.record ? 'on ' : 'off'}  build ${s.build ? 'on ' : 'off'}${by}`);
        }
        return;
      }
      case 'source': {
        const [code, which, value] = args;
        if (!code || (which !== 'record' && which !== 'build') || (value !== 'on' && value !== 'off')) throw new Error(USAGE);
        if (!ctx.catalog.setSourceSwitches(code, { [which]: value === 'on' }, `cli:${process.env.USER ?? 'operator'}`)) {
          throw new Error(`unknown source ${code}`);
        }
        // Don't wait for the worker's next tick: the recorder rereads this within a minute.
        writeControl(ctx.archiveDir, Object.fromEntries(ctx.catalog.sources().map(s => [s.code, { record: s.record }])), now);
        console.log(`${code}: ${which} ${value}`);
        return;
      }
      case 'status': {
        for (const lod of [0, 1, 2] as const) {
          const buckets = ctx.catalog.sealedBuckets(lod, now - 7 * DAY_MS, now);
          const last = buckets[buckets.length - 1];
          console.log(`L${lod}: ${buckets.length} buckets sealed in the last 7 days${last ? `, latest ${iso(last.bucket)} (${last.segments} segments)` : ''}`);
        }
        for (const c of ctx.catalog.coverage(now - DAY_MS, now)) {
          console.log(`  ${c.source.padEnd(10)} ${c.status.padEnd(14)} ${iso(c.tLo)} → ${c.tHi ? iso(c.tHi) : 'open'}`);
        }
        return;
      }
      default:
        console.log(USAGE);
        if (command) process.exitCode = 1;
    }
  } finally {
    ctx.close();
  }
}

main(process.argv.slice(2)).catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
