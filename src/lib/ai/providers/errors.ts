export type ProviderErrorCode = 'auth' | 'quota' | 'rate' | 'model' | 'bad_request' | 'upstream' | 'timeout' | 'network' | 'empty';

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
    public status = 0,
    public retryAfterMs = 0,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  /** Worth one more try: the provider was busy or slow, not refusing. */
  get transient(): boolean {
    return this.code === 'rate' || this.code === 'upstream' || this.code === 'timeout' || this.code === 'network';
  }
}

const KEYLIKE = /\b(?:sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|sk-or-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|gsk_[A-Za-z0-9]{12,}|xai-[A-Za-z0-9]{12,})/g;

/** Removes the key, and anything shaped like one, from text bound for a log or a response. */
export function scrub(text: string, key?: string): string {
  let out = text;
  if (key && key.length >= 6) out = out.split(key).join('[key]');
  return out.replace(KEYLIKE, '[key]');
}

export function classify(status: number, body: string, provider: string, key: string, retryAfter: string | null): ProviderError {
  const detail = scrub(extractMessage(body), key).slice(0, 240);
  const said = detail ? `: ${detail}` : '';
  const retryAfterMs = Math.min(12_000, Math.max(0, Number(retryAfter) * 1000 || 0));
  if (status === 401 || status === 403) return new ProviderError('auth', `${provider} rejected the key${said}`, status);
  if (status === 402) return new ProviderError('quota', `${provider} says the account is out of credit${said}`, status);
  if (status === 429) {
    const quota = /quota|insufficient|billing|credit|exceeded your/i.test(detail);
    return quota
      ? new ProviderError('quota', `${provider} quota exhausted${said}`, status)
      : new ProviderError('rate', `${provider} rate limit${said}`, status, retryAfterMs);
  }
  if (status === 404) return new ProviderError('model', `${provider} does not know that model${said}`, status);
  if (status === 400 || status === 422) {
    // Some providers answer a bad key with 400.
    if (/api[ _-]?key|unauthori[sz]ed|invalid.*key|authentication/i.test(detail)) {
      return new ProviderError('auth', `${provider} rejected the key${said}`, status);
    }
    // A request field the model will not take: the caller can drop it and try again.
    if (/temperature|max_tokens|max_completion_tokens|response_format|responseMimeType/i.test(detail)) {
      return new ProviderError('bad_request', `${provider} refused the request${said}`, status);
    }
    if (/reasoning_effort/i.test(detail)) return new ProviderError('bad_request', `${provider} refused the request${said}`, status);
    if (/model/i.test(detail) && /not (?:found|exist|supported)|unknown|invalid/i.test(detail)) {
      return new ProviderError('model', `${provider} does not know that model${said}`, status);
    }
    return new ProviderError('bad_request', `${provider} refused the request${said}`, status);
  }
  return new ProviderError('upstream', `${provider} error ${status}${said}`, status, retryAfterMs);
}

function extractMessage(body: string): string {
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.error ?? j?.message ?? j?.detail;
    if (typeof m === 'string') return m;
    if (m && typeof m === 'object') return JSON.stringify(m).slice(0, 240);
  } catch { /* not JSON */ }
  return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
