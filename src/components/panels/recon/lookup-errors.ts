// The routes answer in terse developer English; these are the ones people actually hit.
const PLAIN: [RegExp, string][] = [
  [/^invalid domain format$/i, 'That doesn’t look like a domain. Try one like wikipedia.org.'],
  [/^rate limit exceeded$/i, 'Too many lookups in a minute. Wait a moment, then try again.'],
  [/^rate_limited$/i, 'You’ve reached the lookup limit for now. Try again in a few minutes.'],
  [/^scanner not configured$/i, 'The scanner isn’t set up on this server.'],
  [/^target blocked$/i, 'That address is private or reserved, so it can’t be scanned.'],
  [/^scan type not available$/i, 'That kind of scan isn’t allowed here.'],
  [/^scanner unreachable$/i, 'The scanner didn’t answer. Try again in a minute.'],
  [/^user not found$/i, 'No GitHub user has that name.'],
  [/^unrecognized query format/i, 'Use an IP address or an AS number, like AS15169.'],
  [/^network error$/i, 'Couldn’t reach the server. Check your connection and try again.'],
  [/^missing .*parameter/i, 'Type something to look up first.'],
  [/(lookup|scan) failed$/i, 'The lookup didn’t finish. Try again in a moment.'],
];

/** A route's error as a sentence a person can act on; unknown messages pass through. */
export function plainError(message: string): string {
  return PLAIN.find(([re]) => re.test(message.trim()))?.[1] ?? message;
}
