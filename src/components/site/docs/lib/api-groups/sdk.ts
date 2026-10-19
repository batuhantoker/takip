import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const SDK: ApiGroup = {
  id: 'sdk',
  title: msg('Polybolos SDK'),
  blurb:
    'Push entities from an external platform into the Common Operating Picture, and stream the merged picture back out.',
  endpoints: [
    {
      path: '/api/sdk/ingest',
      method: 'POST',
      summary: 'Accepts Polybolos-format entities from an external system and merges them into the map.',
      returns: ['accepted', 'rejected', 'errors', 'timestamp'],
      env: ['SDK_INGEST_KEY'],
      requiresAuth: true,
      notes:
        'Each entity needs `id`, `position.lat`, and `position.lng`; everything else is defaulted. Stored ids are namespaced to `ext-{source}-{id}`, so two platforms can push the same id safely. Fails closed: 503 when `SDK_INGEST_KEY` is unset, 401 on key mismatch, 400 on a malformed payload.',
      bodyExample: `{
  "source": "lattice",
  "apiKey": "$SDK_INGEST_KEY",
  "entities": [
    {
      "id": "TRK-4471",
      "name": "UNKNOWN SURFACE CONTACT",
      "domain": "SEA",
      "entityType": "TRACK",
      "position": { "lat": 36.14, "lng": -5.35, "heading": 271, "speed": 14.2 },
      "threat": "UNKNOWN",
      "classification": "UNCLASSIFIED",
      "confidence": 0.86
    }
  ]
}`,
    },
    {
      path: '/api/sdk/ingest',
      method: 'GET',
      summary: 'Reports how many external entities are currently held, plus recent ingest history.',
      returns: ['sdk', 'version', 'entityCount', 'recentIngestions', 'timestamp'],
    },
    {
      path: '/api/sdk/stream',
      method: 'GET',
      summary: 'Server-Sent Events stream of normalised entities as they arrive.',
      returns: ['…SSE event stream'],
      notes:
        'Opens with a `status` event carrying `connected`, `entityCount`, `feedCount`, `latticeStatus`, and `lastUpdate`. Consume with `EventSource`, not `fetch`.',
    },
  ],
};
