/** camera: looking through a live public camera with the built-in image analysis. */
import { haversine } from '@/lib/core/geodesic';
import { countWords, describeFrame, describeWatch, forModel, type FrameAnalysis, type WatchSummary } from '../../../intel/vision/analysis';
import { sourceOf } from '../../../intel/vision/source';
import type { CameraRecord, Outcome, Site } from '../tools';
import { dataOf, ensure, fail, given, numIn, ok, placeOf, str } from './shared';

/** The full camera records TI fetched (catalog.ts), as records the camera tool can open. */
export function camerasIn(data: Record<string, unknown>): CameraRecord[] {
  const raw = Array.isArray(data.camera_records) ? data.camera_records : [];
  const out: CameraRecord[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const c = r as Record<string, unknown>;
    const id = typeof c.id === 'number' ? String(c.id) : typeof c.id === 'string' ? c.id : '';
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ ...(c as object), id, lat, lng } as CameraRecord);
  }
  return out;
}

export async function camera(a: Record<string, unknown>, site: Site, signal?: AbortSignal): Promise<Outcome> {
  if (!site.camera) return fail('camera', 'Cameras cannot be looked through here');
  if (!(await ensure(site, 'cameras', signal))) return fail('camera', 'The cameras have not loaded yet; try again in a moment');
  const all = camerasIn(dataOf(site));
  const id = str(a.id, 200);
  let cam: CameraRecord | undefined;
  let km: number | undefined;
  if (id) {
    cam = all.find(c => c.id === id);
    if (!cam) return fail('camera', `No camera with id "${id}". Use find with layer cameras for ids`);
  } else if (given(a.near)) {
    const place = await placeOf(site, a.near);
    if (!place) return fail('camera', `Could not find "${str(a.near)}" on the map`);
    const radius = numIn(a.radius_km, 1, 300) ?? 30;
    const near = all
      .filter(c => sourceOf(c))
      .map(c => ({ c, km: haversine([place.lng, place.lat], [c.lng, c.lat]) }))
      .filter(x => x.km <= radius)
      .sort((x, y) => x.km - y.km)[0];
    if (!near) return fail('camera', `No camera that can be analysed within ${radius} km of ${place.name}`);
    cam = near.c;
    km = Math.round(near.km * 10) / 10;
  } else {
    return fail('camera', 'Give a camera id (from find) or near: a place');
  }
  if (!sourceOf(cam)) return fail('camera', `${cam.name ?? 'That camera'} is a web player, so its picture cannot be read. Try another camera nearby`);
  const watch = numIn(a.watch_seconds, 0, 60) ?? 0;
  site.flyTo(cam.lat, cam.lng, 14);
  let looked: { analysis: FrameAnalysis; watch?: WatchSummary };
  try {
    looked = await site.camera(cam, watch);
  } catch (err) {
    return fail('camera', `${cam.name ?? 'The camera'}: ${err instanceof Error ? err.message : 'could not be analysed'}`);
  }
  const name = cam.name || 'Camera';
  const where = [cam.city, cam.country].filter(Boolean).join(', ');
  const seen = describeFrame(looked.analysis);
  return ok('camera', `${name}: ${seen}${looked.watch ? `; ${describeWatch(looked.watch)}` : ''}`, {
    camera: { id: cam.id, name, ...(where ? { where } : {}), ...(cam.source ? { source: cam.source } : {}), lat: cam.lat, lng: cam.lng, ...(km !== undefined ? { km } : {}) },
    ...forModel(looked.analysis, looked.watch),
  }, {
    kind: 'camera', title: name, subtitle: where || undefined,
    items: [
      { label: countWords(looked.analysis.counts), detail: `in view, ${looked.analysis.light} · ${looked.analysis.at.slice(11, 16)} UTC`, lat: cam.lat, lng: cam.lng },
      ...(looked.watch ? [{ label: `Over ${looked.watch.seconds} s`, detail: describeWatch(looked.watch), lat: cam.lat, lng: cam.lng }] : []),
    ],
  });
}
