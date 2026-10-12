// Loaded through vi.hoisted, before nominatim reads these at import: no disk snapshot, no two-second gap.
process.env.TAKIP_NOMINATIM_CACHE = 'off';
process.env.TAKIP_NOMINATIM_GAP_MS = '1';

type Answer = (url: string) => unknown;

/** Stands in for httpJson and fetch: answers by URL prefix, fails anything unexpected, and records every request. */
function fakeUpstream() {
  const calls: string[] = [];
  const answers: [prefix: string, answer: Answer][] = [];
  const respond = async (url: string) => {
    calls.push(url);
    const hit = answers.find(([prefix]) => url.startsWith(prefix));
    if (!hit) throw new Error(`HTTP 599: no fake answer for ${url}`);
    return hit[1](url);
  };
  return {
    calls,
    on(prefix: string, answer: Answer) {
      answers.unshift([prefix, answer]);
    },
    reset() {
      calls.length = 0;
      answers.length = 0;
    },
    httpJson: async (url: string) => respond(url),
    /** Stands in for global fetch: an answer that throws `HTTP <status>` becomes a response with that status. */
    fetch: async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      try {
        return Response.json(await respond(url));
      } catch (error) {
        const status = /^HTTP (\d{3})/.exec(error instanceof Error ? error.message : '')?.[1];
        if (status) return new Response(null, { status: Number(status) });
        throw error;
      }
    },
  };
}

export const upstream = fakeUpstream();

export const fails = (status = 500): Answer => () => {
  throw new Error(`HTTP ${status}`);
};
