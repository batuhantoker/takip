import type { BetterAuthOptions } from 'better-auth';

/** Env prefix → Better Auth provider id, in the order the sign-in dialog lists them. */
export const SOCIAL_PROVIDERS = [
  ['GOOGLE', 'google'],
  ['FACEBOOK', 'facebook'],
  ['APPLE', 'apple'],
  ['MICROSOFT', 'microsoft'],
  ['GITHUB', 'github'],
  ['X', 'twitter'],
  ['DISCORD', 'discord'],
] as const;

export type SocialPrefix = (typeof SOCIAL_PROVIDERS)[number][0];
export type SocialEnv = Partial<Record<`${SocialPrefix}_CLIENT_${'ID' | 'SECRET'}`, string>>;

/** Each provider is offered only once both its client id and secret are set. */
export function socialProviders(env: SocialEnv) {
  const providers: Record<string, object> = {};
  for (const [prefix, id] of SOCIAL_PROVIDERS) {
    const clientId = env[`${prefix}_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CLIENT_SECRET`];
    // Providers that don't vouch for the address (often Facebook) make the user confirm it by email first.
    if (clientId && clientSecret) providers[id] = { clientId, clientSecret, requireEmailVerification: true };
  }
  return providers as NonNullable<BetterAuthOptions['socialProviders']>;
}
