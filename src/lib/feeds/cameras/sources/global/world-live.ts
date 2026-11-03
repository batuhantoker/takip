import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { privateCameras } from '@/lib/feeds/cameras/catalog/private-lists';

/**
 * TAKIP — public live webcams outside Asia.
 *
 * Fills the regions TAKIP had no CCTV coverage for at all: Latin America, the
 * Caribbean, Africa, and the European countries with no traffic-authority feed
 * of their own. Split by continent so viewport-scoped queries stay meaningful.
 */

export async function fetchLatamLiveCameras(): Promise<CctvCamera[]> {
  return privateCameras('skyline', 'latam');
}

export async function fetchAfricaLiveCameras(): Promise<CctvCamera[]> {
  return privateCameras('skyline', 'africa');
}

export async function fetchEuropeLiveCameras(): Promise<CctvCamera[]> {
  return privateCameras('skyline', 'europe');
}
