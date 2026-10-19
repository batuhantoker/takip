import { mintVoiceSession, voiceModel } from '@/lib/ai/assist/live-voice';
import { sanitizeContext } from '@/lib/ai/assist/protocol';
import { credentials, disabled, disabledResponse, fail, json, limited, readBody } from '@/lib/ai/service';

/**
 * TAKIP AI Assist by voice — a short-lived OpenAI Realtime session for a spoken conversation with TI.
 *
 * POST /api/ai/voice
 *   headers  X-AI-Provider: openai, X-AI-Key (the reader's OpenAI key), X-AI-Model (optional, a realtime model)
 *   body     { context: { view, layersOn, loaded, … } }
 *   returns  { value, expires_at, model }: the client secret the browser opens WebRTC with
 *
 * The key goes to OpenAI and nowhere else; nothing is stored here.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  if (disabled()) return disabledResponse();
  if (limited(req, 'voice', 10)) return fail(429, 'Too many voice sessions in a minute. Wait a moment.');
  const body = await readBody(req, 32_000) ?? {};
  const creds = credentials(req, body);
  if ('error' in creds) return fail(400, creds.error);
  if (creds.provider !== 'openai' || !creds.key) return fail(400, 'Live voice runs on OpenAI Realtime: choose OpenAI in TI\'s engine and add your OpenAI key.');

  const out = await mintVoiceSession(creds.key, { model: voiceModel(creds.model), context: body.context ? sanitizeContext(body.context) : null, lang: creds.lang }, fetch, req.signal);
  if (!out.ok) return fail(out.status, out.error);
  return json({ value: out.value, expires_at: out.expiresAt, model: out.model });
}
