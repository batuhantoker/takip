export type DeviceFix = { lat: number; lon: number; accuracy: number | null };

let latest: DeviceFix | null = null;
let sent: DeviceFix | null = null;
let sentBefore: DeviceFix | null = null;

/**
 * Notes the browser's position when the person uses their location on the map (Your location, Use my location,
 * navigation), for the admin's usage statistics. Never asks for a position itself.
 */
export function noteDeviceLocation(coords: { latitude: number; longitude: number; accuracy?: number | null }) {
  latest = { lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy ?? null };
}

/** The latest fix if it hasn't gone yet: the minute tick sends at most one, however fast navigation updates. */
export function takeDeviceLocation(): DeviceFix | undefined {
  if (!latest || latest === sent) return undefined;
  [sentBefore, sent] = [sent, latest];
  return latest;
}

/** After a failed send, so the next tick sends the fix again. */
export function restoreDeviceLocation() {
  sent = sentBefore;
}
