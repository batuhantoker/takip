import { DETAILS_MAX_IDS } from './pins';

/** A camera's full catalogue record: name, place, feed and stream URLs, as /api/cctv lists it. */
export type CameraRecord = { id: string; lat: number; lng: number; [key: string]: unknown };

/** Records seen this session; null for an id the catalogue no longer holds. Oldest dropped past the cap. */
const known = new Map<string, CameraRecord | null>();
const inflight = new Map<string, Promise<void>>();
const KEEP = 5_000;

const remember = (id: string, record: CameraRecord | null) => {
  known.delete(id);
  known.set(id, record);
  if (known.size > KEEP) known.delete(known.keys().next().value!);
};

/** The record if it has already been fetched. */
export const cachedCamera = (id: string): CameraRecord | null | undefined => known.get(id);

async function fetchChunk(ids: string[]) {
  const query = new URLSearchParams(ids.map(id => ['id', id]));
  try {
    const res = await fetch(`/api/cctv/details?${query}`);
    if (!res.ok) return;
    const body = await res.json() as { cameras?: CameraRecord[] };
    const found = new Map((body.cameras ?? []).map(c => [String(c.id), c]));
    for (const id of ids) remember(id, found.get(id) ?? null);
  } catch {
    // Left unknown, so the next ask tries again.
  } finally {
    for (const id of ids) inflight.delete(id);
  }
}

/** Full records for these cameras, fetched in batches the first time each is asked for. */
export async function cameraDetails(ids: readonly string[]): Promise<Map<string, CameraRecord>> {
  const wanted = [...new Set(ids)];
  const missing = wanted.filter(id => !known.has(id) && !inflight.has(id));
  for (let i = 0; i < missing.length; i += DETAILS_MAX_IDS) {
    const chunk = missing.slice(i, i + DETAILS_MAX_IDS);
    const done = fetchChunk(chunk);
    for (const id of chunk) inflight.set(id, done);
  }
  await Promise.all(wanted.map(id => inflight.get(id)));
  const out = new Map<string, CameraRecord>();
  for (const id of wanted) {
    const record = known.get(id);
    if (record) out.set(id, record);
  }
  return out;
}

export async function cameraDetail(id: string): Promise<CameraRecord | undefined> {
  return (await cameraDetails([id])).get(id);
}
