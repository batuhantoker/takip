import { extractJson } from '../parse/values';
import { SYSTEM } from '../prompts/shared';
import { ProviderError } from '../providers/errors';
import type { ChatRequest } from '../providers/chat';
import type { AiEvent, Usage } from '../types';
import type { EngineDeps } from './engine';

/** A failure that ends the run: the key, the account or the model is wrong, so every further call would fail too. */
export class FatalError extends Error {}

const FATAL = new Set(['auth', 'quota', 'model']);

/** At most `limit` tasks at a time, in the order they ask. */
export function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= Math.max(1, limit)) await new Promise<void>(resolve => waiting.push(resolve));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

export class Session {
  usage: Usage = { calls: 0, input: 0, output: 0 };
  private inner = new AbortController();
  readonly signal: AbortSignal;
  /** Every model call of the run, across all its worlds, shares the provider's limit. */
  private gate: ReturnType<typeof limiter>;

  constructor(private deps: EngineDeps) {
    this.signal = AbortSignal.any([deps.signal, this.inner.signal]);
    this.gate = limiter(deps.concurrency);
  }

  emit(e: AiEvent) { this.deps.emit(e); }

  check() {
    if (this.signal.aborted) throw this.signal.reason ?? new Error('aborted');
  }

  /** One model call for a JSON object, with one stricter retry when the reply does not parse. */
  async json(req: Omit<ChatRequest, 'system' | 'json' | 'signal'>): Promise<Record<string, unknown>> {
    for (let attempt = 0; ; attempt++) {
      const user = attempt ? `${req.user}\n\nYour previous reply could not be parsed. Reply with the JSON object only.` : req.user;
      const text = await this.call({ ...req, user, temperature: attempt ? Math.min(req.temperature ?? 0.5, 0.3) : req.temperature, system: SYSTEM, json: true });
      try {
        return extractJson(text);
      } catch (err) {
        if (attempt >= 1) throw err;
      }
    }
  }

  async call(req: Omit<ChatRequest, 'signal'>): Promise<string> {
    this.check();
    try {
      const out = await this.gate(() => { this.check(); return this.deps.chat({ ...req, signal: this.signal }); });
      this.usage = { calls: this.usage.calls + 1, input: this.usage.input + out.input, output: this.usage.output + out.output };
      return out.text;
    } catch (err) {
      this.usage = { ...this.usage, calls: this.usage.calls + 1 };
      if (err instanceof ProviderError && FATAL.has(err.code)) {
        // Stop the calls already in flight: they would fail the same way.
        this.inner.abort(new FatalError(err.message));
        throw new FatalError(err.message);
      }
      throw err;
    }
  }

  emitUsage() { this.emit({ t: 'usage', usage: this.usage }); }
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 240);
