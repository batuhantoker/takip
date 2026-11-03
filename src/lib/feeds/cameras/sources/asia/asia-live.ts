import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { privateCameras } from '@/lib/feeds/cameras/catalog/private-lists';

/**
 * TAKIP — Asia live public webcams.
 *
 * Complements the traffic-authority feeds already wired up for the region
 * (HK Transport Dept, Taiwan THB, Japan MLIT, LTA Singapore) with open public
 * webcams in countries that publish no machine-readable CCTV feed of their own.
 */
export async function fetchAsiaLiveCameras(): Promise<CctvCamera[]> {
  return privateCameras('skyline', 'asia');
}
