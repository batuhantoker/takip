import type { Translate } from '@/lib/core/i18n/translator';
import type { Outage } from '@/lib/intel/outages/outage';
import type { LiveId } from '../catalog/types';
import { auroraLine, issLine, launchLine, outageLine, quakeLine, type LiveLine } from './lines';
import { ownApi } from './own-api';

type Outages = { outages?: Outage[] };

/** The live sentence for a page, fetched when it renders; null when the feed has nothing (the page then leaves it out). */
export async function liveLine(id: LiveId, t: Translate): Promise<LiveLine | null> {
  const now = Date.now();
  switch (id) {
    case 'earthquakes': return quakeLine(await ownApi('/api/earthquakes', 120), now, t);
    case 'launches': return launchLine(await ownApi('/api/launches', 1800), now, t);
    case 'aurora': return auroraLine(await ownApi('/api/aurora', 300), now, t);
    case 'iss': return issLine(await ownApi('/api/satellites?norad=25544', 60), now, t);
    case 'outages': {
      const [cloudflare, ioda] = await Promise.all([ownApi<Outages>('/api/cloudflare-radar', 300), ownApi<Outages>('/api/radar', 300)]);
      return outageLine(cloudflare, ioda, now, t);
    }
  }
}
