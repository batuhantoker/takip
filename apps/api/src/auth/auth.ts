import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { admin, twoFactor } from 'better-auth/plugins';
import { getMigrations } from 'better-auth/db/migration';
import type { Logger } from 'pino';
import { APP_NAME, LINK_TTL_S, deleteAccountEmail, existingAccountEmail, resetPasswordEmail, verificationEmail } from './emails';
import { RESOLVED_IP_HEADER } from '../access/client-ip';
import { impersonationGuard } from '../admin/impersonation-guard';
import { deletionGuard } from '../billing/deletion-guard';
import type { AppDb } from '../db/app-db';
import type { EmailSender } from '../mail/sender';
import type { Env } from '../env';
import { deletedBy, eraseUser } from '../privacy/erase';
import { clearPlaintextOAuthTokens, withoutIdToken } from './oauth-tokens';
import { signInLog } from './sign-ins';
import { socialProviders, type SocialEnv } from './social-providers';

const DAY_S = 24 * 60 * 60;
/** How long an admin's "view as" session lasts (admin/impersonation.ts). */
export const IMPERSONATION_S = 30 * 60;

type AuthEnv = Pick<Env, 'BETTER_AUTH_URL' | 'BETTER_AUTH_SECRET'> & SocialEnv;
/** `billingPortal`: a billing provider is configured, so the client can offer its portal. */
type AuthOptions = { billingPortal?: boolean; logger?: Logger };

/** Where the web app shows a failed social sign-in (src/lib/account/links.ts). */
const SIGN_IN_FAILED = '/?account=sign-in-failed';

function authOptions(db: AppDb, env: AuthEnv, email: EmailSender, { billingPortal = false }: AuthOptions) {
  const social = socialProviders(env);
  const deletion = deletionGuard(db, { billingPortal });
  const logSignIn = signInLog(db);
  return {
    appName: APP_NAME,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: db,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: LINK_TTL_S,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => email.send(resetPasswordEmail(user.email, url)),
      // Sign-up answers the same either way, so the owner hears about the attempt instead.
      onExistingUserSignUp: ({ user }) => email.send(existingAccountEmail(user.email)),
    },
    emailVerification: {
      // The web client asks for the link itself: a callbackURL on sign-in would redirect every successful sign-in.
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      expiresIn: LINK_TTL_S,
      sendVerificationEmail: ({ user, url }) => email.send(verificationEmail(user.email, url)),
    },
    socialProviders: social,
    // Apple posts its callback from its own origin.
    trustedOrigins: 'apple' in social ? ['https://appleid.apple.com'] : [],
    onAPIError: { errorURL: SIGN_IN_FAILED },
    user: {
      modelName: 'auth_user',
      deleteUser: {
        enabled: true,
        // The link only works in a browser signed in to the same account.
        sendDeleteAccountVerification: ({ user, url }) => email.send(deleteAccountEmail(user.email, url)),
        deleteTokenExpiresIn: LINK_TTL_S,
        // Here rather than in databaseHooks: Better Auth deletes sessions and accounts before the user row's hook runs.
        beforeDelete: async user => deletion.assertDeletable(user.id),
      },
    },
    session: {
      modelName: 'auth_session',
      expiresIn: 30 * DAY_S,
      updateAge: DAY_S,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Access and refresh tokens; the key comes from BETTER_AUTH_SECRET.
    account: { modelName: 'auth_account', encryptOAuthTokens: true },
    // Fires on every path that deletes a user; a key already cached lapses within 30 s.
    databaseHooks: {
      user: { delete: { before: async (user, ctx) => void eraseUser(db, user, deletedBy(user.id, ctx?.context.session?.user.id)) } },
      account: { create: { before: withoutIdToken }, update: { before: withoutIdToken } },
      session: { create: { after: async session => logSignIn(session) } },
    },
    verification: { modelName: 'auth_verification' },
    plugins: [
      // Roles and bans. Its own /api/auth/admin/* endpoints are blocked (auth/routes.ts): the console calls it server-side, behind our 2FA gate.
      admin({ defaultRole: 'user', adminRoles: ['admin'], impersonationSessionDuration: IMPERSONATION_S }),
      impersonationGuard(),
      // Guards password sign-in only; social sign-in relies on the provider's own second factor.
      twoFactor({ issuer: APP_NAME, allowPasswordless: true, schema: { twoFactor: { modelName: 'auth_two_factor' } } }),
      deletion.plugin,
    ],
    advanced: {
      cookiePrefix: 'takip',
      // Set per request by access/client-ip.ts, which alone knows the socket peer and which proxies to believe.
      ipAddress: { ipAddressHeaders: [RESOLVED_IP_HEADER] },
      // Pinned: Better Auth otherwise skips the origin check whenever NODE_ENV=test.
      disableOriginCheck: false,
      // Mail goes out after the response, so a known address doesn't answer slower than an unknown one.
      backgroundTasks: {
        handler: task => {
          task.catch(err => console.error('[api] background task failed', err));
        },
      },
    },
  } satisfies BetterAuthOptions;
}

/** Migrates first: Better Auth checks the schema as soon as it starts. Migrations never drop anything. */
export async function createAuth(db: AppDb, env: AuthEnv, email: EmailSender, opts: AuthOptions = {}) {
  const options = authOptions(db, env, email, opts);
  const { runMigrations } = await getMigrations(options);
  await runMigrations();
  const cleared = clearPlaintextOAuthTokens(db);
  if (Object.values(cleared).some(Boolean)) opts.logger?.info({ cleared }, 'cleared plaintext OAuth tokens');
  return betterAuth(options);
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
