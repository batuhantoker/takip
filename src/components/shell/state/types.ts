import type { RouteResult } from '@/components/panels/route/directions-bar';

export type LiveData = any;
export type BackendStatus = 'connecting' | 'connected' | 'error';
export type MapView = { zoom: number; latitude: number };
/**
 * `quiet`: moves the map without bringing it back over the space view (the start-up fly-in to the viewer's area).
 * `offset`: where the target lands, in pixels from the map's centre. `onArrive`: runs once the camera is there.
 */
export type FlyToTarget = { lat: number; lng: number; zoom?: number; alertId?: string; duration?: number; quiet?: boolean; offset?: [number, number]; onArrive?: () => void; ts: number };
export type MapCenter = { lat: number; lng: number; bounds?: { west: number; south: number; east: number; north: number } };
export type MobilePanel = 'layers'|'markets'|'intel'|'history'|'space'|'search'|'recon'|'ai';
export type MapProjection = 'globe'|'mercator';
export type MapStyle = 'dark'|'satellite'|'topo';
export type ActiveRoute = RouteResult & {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  alternates?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
  activeSegment?: [number, number][] | null;
};
export type NavSession = { route: RouteResult; label: string; key: number };
