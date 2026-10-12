/*
 * One line of the raw archive (replay-database.md §7.1). The archive is the source of truth:
 * every table that holds live data is a function of these lines.
 */

/** What an upstream returned, as received. `body` is the parsed JSON, or the text for non-JSON feeds. */
export type RawEnvelope = {
  v: 1;
  src: string;
  /** When we received it, epoch ms. */
  at: number;
  /** Request URL with keys stripped; absent for stream frames. */
  url?: string | null;
  status?: number;
  etag?: string | null;
  /** Fetch duration. */
  ms?: number;
  sha256?: string;
  err?: string;
  /** Backfilled: the time the payload describes; the line sits in that hour's file. */
  for?: number;
  body: unknown;
};

/** Written once a minute per source, so "alive but empty" differs from "recorder down". */
export type Heartbeat = {
  v: 1;
  src: string;
  at: number;
  /** `off`: switched off in the admin console, so silence here is intended. */
  hb: { n: number; dropped: number; paused: boolean; off?: boolean };
};

/** Written to the `_recorder` source when lines were lost. */
export type DropLine = {
  v: 1;
  src: '_recorder';
  at: number;
  drop: { src: string; n: number; reason: DropReason };
};

export type DropReason = 'queue_full' | 'disk' | 'write_failed';

export type ArchiveLine = RawEnvelope | Heartbeat | DropLine;

export const isEnvelope = (line: ArchiveLine): line is RawEnvelope => 'body' in line;
export const isHeartbeat = (line: ArchiveLine): line is Heartbeat => 'hb' in line;
