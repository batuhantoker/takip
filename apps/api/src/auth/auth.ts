import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { admin, twoFactor } from 'better-auth/plugins';
import { getMigrations } from 'better-auth/db/migration';
import { APP_NAME, LINK_TTL_S, deleteAccountEmail, existingAccountEmail, resetPasswordEmail, verificationEmail } from './emails';
import { RESOLVED_IP_HEADER } from '../access/client-ip';
import type { AppDb } from '../db/app-db';
import type { EmailSender } from '../mail/sender';
import type { Env } from '../env';
import { socialProviders, type SocialEnv } from './social-providers';

const DAY_S = 24 * 60 * 60;

type AuthEnv = Pick<Env, 'BETTER_AUTH_URL' | 'BETTER_AUTH_SECRET'> & SocialEnv;

/** Where the web app shows a failed social sign-in (src/lib/account-links.ts). */
const SIGN_IN_FAILED = '/?account=sign-in-failed';

function authOptions(db: AppDb, env: AuthEnv, email: EmailSender) {
  const social = socialProviders(env);
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
      },
    },
    session: {
      modelName: 'auth_session',
      expiresIn: 30 * DAY_S,
      updateAge: DAY_S,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
    plugins: [
      // Roles and bans. Its own /api/auth/admin/* endpoints are blocked (auth/routes.ts): the console calls it server-side, behind our 2FA gate.
      admin({ defaultRole: 'user', adminRoles: ['admin'] }),
      // Guards password sign-in only; social sign-in relies on the provider's own second factor.
      twoFactor({ issuer: APP_NAME, allowPasswordless: true, schema: { twoFactor: { modelName: 'auth_two_factor' } } }),
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
export async function createAuth(db: AppDb, env: AuthEnv, email: EmailSender) {
  const options = authOptions(db, env, email);
  const { runMigrations } = await getMigrations(options);
  await runMigrations();
  return betterAuth(options);
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
