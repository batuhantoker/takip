import { getRun, injectEvent, ownsRun } from '@/lib/ai/runs';
import { aiHeader, disabled, disabledResponse, fail, json, readBody } from '@/lib/ai/service';

/**
 * TAKIP AI — the god's-eye view: drop an event into a running simulation.
 * It lands in every simulated world at the start of the next period.
 *
 * POST /api/ai/runs/{id}/inject
 *   headers  X-AI-Run-Token (from the start response)
 *   body     { text }
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (disabled()) return disabledResponse();
  const run = getRun((await params).id);
  if (!run) return fail(404, 'No such run.');
  if (!ownsRun(run, aiHeader(req, 'run-token'))) return fail(403, 'Only whoever started the run can inject events (X-AI-Run-Token).');
  const body = await readBody(req, 4_000);
  if (!body) return fail(400, 'Send a JSON body: { "text": "…" }.');
  const done = injectEvent(run, body.text);
  if (!done.ok) return fail(done.status, done.error);
  return json({ id: run.id, queued: true, lands_in_period: Math.min(run.state.rounds.length + 1, run.state.periodsPlanned) || 1 }, 202);
}
