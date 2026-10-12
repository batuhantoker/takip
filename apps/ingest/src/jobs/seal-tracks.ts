import { statSync } from 'node:fs';
import { isEnvelope, isHeartbeat } from '@takip/archive/envelope';
import { readSourceHour } from '@takip/archive/reader';
import { HOUR_MS } from '@takip/core/time';
import { AIRCRAFT_CATEGORIES, VESSEL_CATEGORIES, type TrackClassName } from '@takip/core/tracks';
import { type CoverageStatus, type SegmentRow, shardPeriod } from '@takip/db';
import { CONNECTORS, TRACK_SOURCES } from '../connectors';
import type { IngestCtx } from '../context';
import { buildSegments, dedupe, type Fix } from '../tracks/segments';

/** Bump when segment building changes, so rebuilt buckets are told apart from old ones. */
export const BUILD_VERSION = 1;

/** Hour H is sealed at H+2:05: fixes for H can arrive in H+1's file (§7.3). */
export const SEAL_DELAY_MS = 2 * HOUR_MS + 5 * 60_000;

export const TRACK_LAYERS = ['tracks:vessel', 'tracks:aircraft'];

type SourceStats = { envelopes: number; ok: number; failed: number; dropped: number; paused: boolean; off: boolean };

type Pending = {
  cls: TrackClassName;
  scheme: 'mmsi' | 'icao24';
  sourceId: number;
  fixes: Fix[];
  label?: string;
  categories: Map<string, number>;
  tIsReceive: boolean;
};

type State = { name?: string; category?: string };

export type SealSummary = { hour: number; entities: number; segments: number; points: number; coverage: Record<string, CoverageStatus> };

/**
 * Builds the L0 segments of one hour from the archive and publishes them (§7.3). Idempotent:
 * re-sealing replaces the bucket, so live sealing and rebuilds run the same code.
 */
export async function sealHour(ctx: IngestCtx, hour: number): Promise<SealSummary> {
  const sources = new Map(ctx.catalog.sources().map(s => [s.code, s]));
  const pending = new Map<string, Pending>();
  const states = new Map<string, State>();
  const coverage: Record<string, CoverageStatus> = {};

  for (const code of TRACK_SOURCES) {
    const source = sources.get(code);
    if (!source || source.trackBit === null) continue;
    const stats: SourceStats = { envelopes: 0, ok: 0, failed: 0, dropped: 0, paused: false, off: false };
    const connector = CONNECTORS[code];
    const mask = 2 ** source.trackBit;
    for (const fileHour of [hour, hour + HOUR_MS]) {
      for await (const line of readSourceHour(ctx.archiveDir, code, fileHour, { onIssue: ctx.log })) {
        if (fileHour === hour) count(stats, line);
        if (!isEnvelope(line) || !source.build) continue;
        for (const obs of connector.map(line)) {
          if (obs.shape === 'tle') continue;
          const key = `${obs.scheme}:${obs.key}`;
          if (obs.shape === 'state') {
            // Static data from either file describes the hour well enough; it changes over voyages, not minutes.
            const s = states.get(key) ?? {};
            states.set(key, { name: obs.name ?? s.name, category: obs.category ?? s.category });
            continue;
          }
          if (obs.t < hour || obs.t >= hour + HOUR_MS) continue;
          let p = pending.get(key);
          if (!p) pending.set(key, (p = { cls: obs.cls, scheme: obs.scheme, sourceId: source.sourceId, fixes: [], categories: new Map(), tIsReceive: false }));
          p.fixes.push({ t: obs.t, lon: obs.lon, lat: obs.lat, alt: obs.alt, speed: obs.speed, heading: obs.heading, mask });
          if (obs.label) p.label = obs.label;
          if (obs.category) p.categories.set(obs.category, (p.categories.get(obs.category) ?? 0) + 1);
          if (obs.tIsReceive) p.tIsReceive = true;
        }
      }
    }
    // A bulk source covers only the hours someone backfilled; silence elsewhere isn't an outage.
    if (source.delivery === 'bulk' && stats.envelopes === 0) continue;
    coverage[code] = !source.build ? 'not_recording' : coverageStatus(stats);
  }

  const segments = buildHour(ctx, pending, states);
  const points = segments.reduce((n, s) => n + s.n, 0);
  // Entities exist already (buildHour); facts next, publication last (§4.2).
  const { path, rows } = ctx.tracks.sealBucket(0, hour, segments, BUILD_VERSION);
  const period = shardPeriod(0, hour);
  ctx.catalog.markSealed(
    { lod: 0, bucket: hour, segments: segments.length, points, buildVersion: BUILD_VERSION, sealedAt: ctx.now() },
    { path: ctx.layout.shardKey(path), kind: 'tracks', lod: 0, tLo: period.lo, tHi: period.hi, status: 'open', rows, bytes: statSync(path).size },
    TRACK_LAYERS,
  );
  for (const [code, status] of Object.entries(coverage)) ctx.catalog.setCoverage(sources.get(code)!.sourceId, hour, hour + HOUR_MS, status);
  return { hour, entities: pending.size, segments: segments.length, points, coverage };
}

function count(stats: SourceStats, line: Parameters<typeof isEnvelope>[0]) {
  if (isHeartbeat(line)) {
    stats.dropped += line.hb.dropped;
    stats.paused ||= line.hb.paused;
    stats.off ||= Boolean(line.hb.off);
  } else if (isEnvelope(line)) {
    stats.envelopes++;
    // Stream frames carry no status; they only exist because the stream delivered them.
    if (line.status === undefined || (line.status >= 200 && line.status < 300)) stats.ok++;
    else stats.failed++;
  }
}

export function coverageStatus(s: SourceStats): CoverageStatus {
  if (s.envelopes === 0) return s.off || (!s.paused && s.dropped === 0) ? 'not_recording' : 'down';
  if (s.ok === 0) return 'down';
  return s.failed || s.dropped || s.paused ? 'degraded' : 'ok';
}

function buildHour(ctx: IngestCtx, pending: Map<string, Pending>, states: Map<string, State>): SegmentRow[] {
  // One identity batch per (scheme, source): a short transaction each, and the id cache does the rest.
  const groups = new Map<string, [string, Pending][]>();
  for (const entry of pending) {
    const g = `${entry[1].scheme}\t${entry[1].sourceId}`;
    const list = groups.get(g);
    if (list) list.push(entry);
    else groups.set(g, [entry]);
  }
  const ids = new Map<string, number>();
  for (const list of groups.values()) {
    const { scheme, sourceId, cls } = list[0][1];
    const items = list.map(([key, p]) => {
      const value = key.slice(scheme.length + 1);
      let first = Infinity;
      let last = -Infinity;
      for (const f of p.fixes) {
        first = Math.min(first, f.t);
        last = Math.max(last, f.t);
      }
      // Vessel names are stable; callsigns change per flight, so aircraft entities stay unnamed.
      const name = cls === 'vessel' ? (states.get(key)?.name ?? p.label ?? null) : null;
      return { value, first, last, name };
    });
    for (const [value, id] of ctx.catalog.ensureIdentities(cls, scheme, sourceId, items)) ids.set(`${scheme}:${value}`, id);
  }

  const vesselIds = [...pending].filter(([, p]) => p.cls === 'vessel').map(([key]) => ids.get(key)!);
  const known = ctx.catalog.entityCategories(vesselIds);
  const learned = new Map<number, string>();

  const segments: SegmentRow[] = [];
  for (const [key, p] of pending) {
    const entityId = ids.get(key)!;
    let category: string;
    if (p.cls === 'vessel') {
      const stated = states.get(key)?.category;
      if (stated) learned.set(entityId, stated);
      category = stated ?? known.get(entityId) ?? 'other';
    } else {
      // Any source calling it military wins; otherwise the most common answer.
      category = p.categories.has('military') ? 'military' : [...p.categories].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'commercial';
    }
    const codes: readonly string[] = p.cls === 'vessel' ? VESSEL_CATEGORIES : AIRCRAFT_CATEGORIES;
    const label = p.cls === 'vessel' ? (states.get(key)?.name ?? p.label ?? null) : (p.label ?? null);
    segments.push(...buildSegments({
      entityId,
      cls: p.cls,
      category: Math.max(0, codes.indexOf(category)),
      label,
      tIsReceive: p.tIsReceive,
      fixes: dedupe(p.fixes),
    }, 0));
  }
  ctx.catalog.setEntityCategories(learned);
  return segments;
}
