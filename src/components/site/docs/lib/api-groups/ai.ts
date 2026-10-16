import type { ApiGroup } from '../../api-catalog';

const CONTEXT = `{
    "earthquakes": [],
    "news": [],
    "threats": [],
    "cyberAlerts": [],
    "timestamp": "2026-07-29T12:00:00Z"
  }`;

export const AI: ApiGroup = {
  id: 'ai',
  title: 'AI analysis',
  blurb:
    'Gemini-backed correlation over feed data you supply. All three are POST. Analyze and briefing allow 5 requests a minute per IP, overview 20. The server’s own Gemini key is for Pro plans; analyze and briefing run free for anyone on a Gemini key sent in X-Gemini-Key.',
  endpoints: [
    {
      path: '/api/ai/analyze',
      method: 'POST',
      summary: 'Cross-feed correlation and threat assessment over an intelligence context.',
      returns: ['analysis', 'model', 'timestamp'],
      notes:
        'Body is a `query` and an `IntelligenceContext` in `context`. Exceeding the limit returns 429. Feed it straight from the read endpoints — the shape matches what they return. Without `X-Gemini-Key` the server’s key is used, which needs a Pro plan: otherwise 403 `{ "error": "entitlement_required", "entitlement": "ai.hosted" }`, or 503 `{ "error": "access_unavailable" }` when the plan can’t be checked.',
      env: ['GEMINI_API_KEY_1 … GEMINI_API_KEY_8'],
      bodyExample: `{
  "query": "What links the latest quakes and outages?",
  "context": ${CONTEXT}
}`,
    },
    {
      path: '/api/ai/briefing',
      method: 'POST',
      summary: 'Structured threat briefing in the style of a daily intelligence product.',
      returns: ['briefing', 'generatedAt'],
      notes: 'Body is an `IntelligenceContext` in `context`, with no query. Same rate limit and key rules as `/api/ai/analyze`.',
      env: ['GEMINI_API_KEY_1 … GEMINI_API_KEY_8'],
      bodyExample: `{
  "context": ${CONTEXT}
}`,
    },
    {
      path: '/api/ai/overview',
      method: 'POST',
      summary: 'One-click read-out for the Alerts, Markets or chain-threat panel. Alerts also return a structured brief: threads by theatre, perspective and seismic summary.',
      returns: ['mode', 'overview', 'highlights', 'generatedBy', 'generatedAt', 'brief', 'hostedAi'],
      env: ['GEMINI_API_KEY_1 … GEMINI_API_KEY_8'],
      notes: '`mode` is `alerts`, `markets` or `chain`. Gemini writes the read-out for Pro plans; everyone else gets the heuristic analyst, and `hostedAi` says why (`entitlement_required`, or `access_unavailable` when the plan can’t be checked).',
      bodyExample: `{
  "mode": "alerts",
  "payload": {
    "news": [{ "id": "a1", "title": "Drone attack on Kharkiv", "source": "t.me/liveuamap", "bloc": "western", "published": "2026-09-17T11:00:00Z" }],
    "earthquakes": [{ "magnitude": 5.4, "place": "80 km S of Kuril", "time": 1789646400000 }]
  }
}`,
    },
  ],
};
