import { msg, type Translate } from '@/lib/core/i18n/translator';

// The routes answer in terse developer English; these are the ones people actually hit.
const PLAIN: [RegExp, string][] = [
  [/^invalid domain format$/i, msg('That doesn’t look like a domain. Try one like wikipedia.org.')],
  [/^rate limit exceeded$/i, msg('Too many lookups in a minute. Wait a moment, then try again.')],
  [/^rate_limited$/i, msg('You’ve reached the lookup limit for now. Try again in a few minutes.')],
  [/^scanner not configured$/i, msg('The scanner isn’t set up on this server.')],
  [/^target blocked$/i, msg('That address is private or reserved, so it can’t be scanned.')],
  [/^scan type not available$/i, msg('That kind of scan isn’t allowed here.')],
  [/^scanner unreachable$/i, msg('The scanner didn’t answer. Try again in a minute.')],
  [/^user not found$/i, msg('No GitHub user has that name.')],
  [/^unrecognized query format/i, msg('Use an IP address or an AS number, like AS15169.')],
  [/^network error$/i, msg('Couldn’t reach the server. Check your connection and try again.')],
  [/^missing .*parameter/i, msg('Type something to look up first.')],
  [/(lookup|scan) failed$/i, msg('The lookup didn’t finish. Try again in a moment.')],
];

/** A route's error as a sentence a person can act on; unknown messages pass through. */
export function plainError(message: string, t: Translate): string {
  const known = PLAIN.find(([re]) => re.test(message.trim()))?.[1];
  return known ? t(known) : message;
}
