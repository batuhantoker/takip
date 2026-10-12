import type { RouteResult } from '@/components/directions/directions-bar';

export type LiveData = any;
export type BackendStatus = 'connecting' | 'connected' | 'error';
export type MapView = { zoom: number; latitude: number };
export type FlyToTarget = { lat: number; lng: number; zoom?: number; alertId?: string; duration?: number; ts: number };
export type MapCenter = { lat: number; lng: number; bounds?: { west: number; south: number; east: number; north: number } };
export type MobilePanel = 'layers'|'markets'|'intel'|'search'|'recon'|'oi';
export type MapProjection = 'globe'|'mercator';
export type MapStyle = 'dark'|'satellite';
export type ActiveRoute = RouteResult & {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  alternates?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
  activeSegment?: [number, number][] | null;
};
export type NavSession = { route: RouteResult; label: string; key: number };
