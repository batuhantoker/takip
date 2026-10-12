import { createAuthClient } from 'better-auth/react';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';

/** Talks to the api service through this origin's /api/auth proxy (next.config.ts). */
export const authClient = createAuthClient({ plugins: [twoFactorClient(), adminClient()] });
