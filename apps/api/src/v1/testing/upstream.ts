// Loaded through vi.hoisted, before nominatim reads these at import: no disk snapshot, no two-second gap.
process.env.TAKIP_NOMINATIM_CACHE = 'off';
process.env.TAKIP_NOMINATIM_GAP_MS = '1';

type Answer = (url: string) => unknown;

/** Stands in for httpJson: answers by URL prefix, fails anything unexpected, and records every request. */
function fakeUpstream() {
  const calls: string[] = [];
  const answers: [prefix: string, answer: Answer][] = [];
  return {
    calls,
    on(prefix: string, answer: Answer) {
      answers.unshift([prefix, answer]);
    },
    reset() {
      calls.length = 0;
      answers.length = 0;
    },
    httpJson: async (url: string) => {
      calls.push(url);
      const hit = answers.find(([prefix]) => url.startsWith(prefix));
      if (!hit) throw new Error(`HTTP 599: no fake answer for ${url}`);
      return hit[1](url);
    },
  };
}

export const upstream = fakeUpstream();

export const fails = (status = 500): Answer => () => {
  throw new Error(`HTTP ${status}`);
};
