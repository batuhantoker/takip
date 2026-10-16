import { assistStep } from '@/lib/ai/assist/server';
import { credentials, disabled, disabledResponse, fail, json, limited, readBody, type Credentials } from '@/lib/ai/service';

/**
 * TAKIP AI Assist — one step of the conversation.
 *
 * POST /api/ai/assist
 *   headers  X-AI-Provider, X-AI-Key, X-AI-Model (optional)
 *   body     { messages: [...], context: { view, layersOn, loaded, forecast } }
 *   returns  { step: { say, actions, done }, usage }
 *
 * The page runs the actions on the map and, when the step is not done, sends
 * their results back for the next step. Nothing is stored here.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (disabled()) return disabledResponse();
  if (limited(req, 'assist', 40)) return fail(429, 'Too many steps in a minute. Wait a moment.');
  const body = await readBody(req, 96_000);
  if (!body) return fail(400, 'Send a JSON body: { "messages": [...], "context": {...} }.');
  const creds = credentials(req, body);
  if ('error' in creds) return fail(400, creds.error);

  if (body.stream === true) return streamed(body, creds, req.signal);
  const out = await assistStep(body, creds, req.signal);
  if (!out.ok) return fail(out.status, out.error);
  return json({ step: { say: out.step.say, actions: out.step.calls, done: out.step.done }, usage: out.usage });
}

/**
 * The same step as server-sent events: `delta` {kind, text} while the model writes (its reasoning, where it
 * shows any, and its answer), then `step` {step, usage} or `error` {status, error}. Deltas go out at most
 * every 80 ms, so a fast model is a few dozen events, not thousands.
 */
function streamed(body: Record<string, unknown>, creds: Credentials, signal: AbortSignal): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let pending: { kind: string; text: string }[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => {
        timer = null;
        for (const d of pending) send('delta', d);
        pending = [];
      };
      const out = await assistStep(body, creds, signal, undefined, d => {
        const last = pending.at(-1);
        if (d.kind === 'reset') pending = [{ kind: 'reset', text: '' }];
        else if (last && last.kind === d.kind) last.text += d.text;
        else pending.push({ ...d });
        timer ??= setTimeout(flush, 80);
      });
      if (timer) clearTimeout(timer);
      flush();
      if (out.ok) send('step', { step: { say: out.step.say, actions: out.step.calls, done: out.step.done }, usage: out.usage });
      else send('error', { status: out.status, error: out.error });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}
