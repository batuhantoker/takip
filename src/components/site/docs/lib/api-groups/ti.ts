import type { ApiGroup } from '../../api-catalog';

export const TI: ApiGroup = {
  id: 'ti',
  title: 'TI, Takip AI (assist and prediction)',
  blurb:
    'TI Assist, a model on your own key that works the map in conversation, and a prediction engine on live TAKIP intelligence: it casts the actors who decide a question, plays them against each other over dated periods in several parallel worlds, and a report agent writes the predicted path with a calibrated figure. Your model key is sent in headers and never stored. Also served as an MCP server at /api/mcp; see TI guide.',
  endpoints: [
    {
      path: '/api/ai',
      method: 'GET',
      summary: 'What the service offers: providers and their default models, run depths and their model-call counts, limits and endpoints.',
      returns: ['name', 'version', 'credit', 'providers', 'depths', 'limits', 'auth', 'endpoints'],
    },
    {
      path: '/api/ai/models',
      method: 'POST',
      summary: 'The models your key can use, straight from the provider. Doubles as a key check: a rejected key fails here, before a run spends anything.',
      returns: ['provider', 'ok', 'listed', 'models', 'default'],
      headers: { 'X-AI-Key': '$YOUR_MODEL_KEY' },
      requiresAuth: true,
      notes: 'Providers: `openai`, `anthropic`, `google`, `openrouter`, `groq`, `deepseek`, `xai`, `mistral`, `qwen`. 401 when the provider rejects the key, 402 when the account is out of credit. 20 checks per minute per address.',
      bodyExample: `{
  "provider": "openai"
}`,
    },
    {
      path: '/api/ai/runs',
      method: 'POST',
      summary: 'Start a prediction. Answers 202 at once with the run id, a link to watch it on the globe, and a run token for steering it.',
      returns: ['id', 'status', 'phase', 'watch_url', 'events_url', 'run_token', 'progress'],
      headers: { 'X-AI-Provider': 'openai', 'X-AI-Key': '$YOUR_MODEL_KEY', 'X-AI-Model': 'gpt-5-mini' },
      requiresAuth: true,
      notes: '`depth` is `quick` (4 actors × 3 periods × 2 worlds, about 34 model calls), `standard` (6 × 4 × 3, about 88) or `deep` (7 × 4 × 4, about 132). A world that settles early stops spending calls. `seed` takes up to 100,000 characters of your own data (about 25,000 input tokens), read once by the world model; with `seed_scope: "panel"` every actor’s move and the report agent also read its first 8,000 characters, at about 2,000 more input tokens a call. `use_feeds` (default true) has the run research the question first (recent news with its links, from GDELT and Wikipedia’s Current events, and Wikipedia background) and read TAKIP news, quakes and markets; the actors quote these sources by id: articles (`w`), market data (`q`), prediction markets (`m`), background (`b`), the live feeds (`c`). Keep `run_token`: it is not shown again. Two runs at once and eight per ten minutes per address.',
      bodyExample: `{
  "question": "Will Brent crude settle above $90 on 31 December 2026?",
  "depth": "standard",
  "use_feeds": true
}`,
    },
    {
      path: '/api/ai/runs/{id}',
      method: 'GET',
      summary: 'A run summary: phase and progress, the simulated periods, the worlds pooled period by period, each world with its events, the cast with their personas, and once written, the report: the predicted path, what each actor does, how each world ended, drivers, scenarios, signposts and dissent, with the sources they quote.',
      params: [
        { name: 'wait', desc: 'Seconds (up to 55) to wait for the run to finish before answering.', example: '30' },
        { name: 'view', desc: '`full` returns every event so far, to rebuild the whole run.', example: 'full' },
      ],
      returns: ['id', 'status', 'phase', 'kind', 'answer', 'probability_pct', 'outcomes', 'unit', 'proposition', 'measure', 'baseline', 'market', 'progress', 'periods', 'pooled', 'report', 'actors', 'worlds', 'sources', 'injected', 'usage', 'watch_url'],
      notes: '`kind` is `binary` (a probability of YES), `choice` (a share for each of `outcomes`) or `number` (an `estimate` with an 80% `low`–`high` range, in `unit`); `answer` says it in words either way. On a question about a price, `measure` names it (ticker, level, side, touch or close), and `baseline` gives the statistical baseline from its own history (`probability_pct` or a `p10`–`p90` range) and, once the run is done, `simulated`: the worlds’ events priced across the market’s own paths. `market` is the id of the source (an `odds` source, with `odds.probability_pct`) that is a prediction market on this same question. Anyone with the id can read a run: that is how a prediction is shared. Runs are kept for three hours after they finish.',
    },
    {
      path: '/api/ai/runs/{id}/events',
      method: 'GET',
      summary: 'The run as it happens, over Server-Sent Events: phases, actors and relations, the cast and the simulated clock, every move, event and world standing, the worlds pooled after each period, injected events and the report.',
      returns: ['…SSE event stream'],
      notes: 'Each event is `id: <seq>` and `data: <json>`, with a `t` field naming its type. The stream replays from the start, follows live, and closes after `end`. Reconnect with `Last-Event-ID` (or `?after=<seq>`) to resume.',
    },
    {
      path: '/api/ai/trending',
      method: 'GET',
      summary: 'What the world is betting on: the busiest open questions on Polymarket that can be predicted (not games, at least two weeks out), each with the crowd’s price of YES. No key; kept ten minutes.',
      returns: ['items[].question', 'items[].probability', 'items[].event', 'items[].url', 'items[].closes'],
      notes: '30 requests per minute per address.',
    },
    {
      path: '/api/ai/assist',
      method: 'POST',
      summary: "One step of a TI Assist conversation: send the conversation and what is on the map; get back what TI says and the actions it wants taken (go_to, layers, find, highlight, show, markets, open, map_view, forecast, clear).",
      returns: ['step.say', 'step.actions', 'step.done', 'usage'],
      headers: { 'X-AI-Provider': 'openai', 'X-AI-Key': '$YOUR_MODEL_KEY' },
      requiresAuth: true,
      notes: 'Stateless: the conversation lives with the caller. Carry out the actions, and while `done` is false send their results back as a `tool` message for the next step. 40 steps per minute per address.',
      bodyExample: `{
  "messages": [{ "role": "user", "text": "Military aircraft near Frankfurt", "mode": "research" }],
  "context": { "view": { "lat": 50.1, "lng": 8.7, "zoom": 6 }, "layersOn": ["military"], "loaded": { "military_flights": 104 } }
}`,
    },
    {
      path: '/api/ai/runs/{id}/ask',
      method: 'POST',
      summary: 'Question the report agent, or any actor that played (by id), about a run. Uses your key again.',
      returns: ['id', 'target', 'reply'],
      headers: { 'X-AI-Key': '$YOUR_MODEL_KEY' },
      requiresAuth: true,
      notes: "Provider and model default to the run's own; send `X-AI-Provider` and `X-AI-Model` to ask on another. 20 questions per minute per address.",
      bodyExample: `{
  "target": "report",
  "message": "What would change this prediction most?"
}`,
    },
    {
      path: '/api/ai/runs/{id}/inject',
      method: 'POST',
      summary: "God's-eye view: drop an event into a running simulation. It happens in every world in the next period of simulated time.",
      returns: ['id', 'queued', 'lands_in_period'],
      headers: { 'X-AI-Run-Token': '$RUN_TOKEN' },
      requiresAuth: true,
      notes: 'Needs the run token from the start response. Up to eight events per run; refused once the report is being written.',
      bodyExample: `{
  "text": "OPEC+ calls an emergency meeting for Friday"
}`,
    },
    {
      path: '/api/ai/runs/{id}',
      method: 'DELETE',
      summary: 'Cancel a running prediction.',
      returns: ['id', 'cancelled', 'status'],
      headers: { 'X-AI-Run-Token': '$RUN_TOKEN' },
      requiresAuth: true,
    },
    {
      path: '/api/mcp',
      method: 'POST',
      summary: 'TI and live TAKIP intelligence as an MCP server (Streamable HTTP, stateless) for agents such as Hermes, Claude and Cursor.',
      returns: ['jsonrpc', 'id', 'result'],
      headers: { Accept: 'application/json, text/event-stream', 'X-AI-Provider': 'openai', 'X-AI-Key': '$YOUR_MODEL_KEY' },
      notes: 'Tools: `ai_predict`, `ai_get_run`, `ai_ask`, `ai_inject`, `ai_cancel`, `ai_info`, and the free `takip_world_brief`, `takip_markets` and `takip_trending`, which need no key. A call that waits on a forecast streams progress notifications when the client accepts SSE. Protocol versions 2025-06-18, 2025-03-26 and 2024-11-05. GET and DELETE answer 405: the server opens no streams of its own. 120 calls per minute per address.',
      bodyExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}`,
    },
  ],
};
