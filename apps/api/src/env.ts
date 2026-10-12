import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { LOOPBACK, parseProxies } from './access/client-ip';
import { SOCIAL_PROVIDERS, type SocialPrefix } from './auth/social-providers';
import { PROVIDER_IDS } from './billing/provider';
import { unavailableReason } from './billing/registry';
import { parseCidr } from './net/cidr';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const socialShape = Object.fromEntries(
  SOCIAL_PROVIDERS.flatMap(([prefix]) => [
    [`${prefix}_CLIENT_ID`, z.string().optional()],
    [`${prefix}_CLIENT_SECRET`, z.string().optional()],
  ]),
) as Record<`${SocialPrefix}_CLIENT_${'ID' | 'SECRET'}`, z.ZodOptional<z.ZodString>>;

function isProxyList(list: string) {
  try {
    parseProxies(list);
    return true;
  } catch {
    return false;
  }
}

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().positive().default(4100),
    APP_DB_PATH: z.string().default(`${repoRoot}data/db/app.db`),
    // Days of usage_counter kept for accounts and their keys, and for anonymous visitors.
    USAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(400),
    USAGE_ANON_RETENTION_DAYS: z.coerce.number().int().positive().default(35),
    // The origin the browser sees (the web app), not this server's own address.
    BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    // smtp(s)://user:pass@host:port from any provider. Unset in development: mail prints to the console.
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    // Replay data platform (docs/architecture/replay-database.md §4.1). Relative paths mean the repo root.
    TAKIP_DATA_DIR: z.string().default('data').transform(p => resolve(repoRoot, p)),
    TAKIP_ARCHIVE_DIR: z.string().optional().transform(p => (p ? resolve(repoRoot, p) : undefined)),
    // Peers whose X-Forwarded-For is believed (IPs or CIDR ranges). Loopback covers the Next rewrite in development.
    TRUSTED_PROXIES: z.string().default(LOOPBACK).refine(isProxyList, 'comma-separated IPs or CIDR ranges'),
    // Cloudflare is the edge: believe cf-connecting-ip from a trusted peer.
    CLOUDFLARE_EDGE: z.stringbool().default(false),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Peers besides loopback that may read GET /metrics, e.g. the Prometheus host: comma-separated CIDRs.
    METRICS_ALLOW: z.string().default('')
      .transform(list => list.split(',').map(rule => rule.trim()).filter(Boolean))
      .pipe(z.array(z.string().refine(rule => parseCidr(rule) !== null, 'expected a CIDR such as 10.0.0.0/8'))),
    // Payment provider for /api/billing (backend.md §7.3). Unset: billing is off and checkout answers 501.
    BILLING_PROVIDER: z.preprocess(v => (v === '' ? undefined : v), z.enum(PROVIDER_IDS).optional()),
    ...socialShape,
  })
  .superRefine((e, ctx) => {
    const required = e.NODE_ENV === 'production' ? (['BETTER_AUTH_SECRET', 'SMTP_URL', 'MAIL_FROM'] as const) : [];
    for (const key of required) {
      if (!e[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required in production' });
    }
    if (e.SMTP_URL && !e.MAIL_FROM) ctx.addIssue({ code: 'custom', path: ['MAIL_FROM'], message: 'required with SMTP_URL' });
    const billingProblem = e.BILLING_PROVIDER && unavailableReason(e.BILLING_PROVIDER, e.NODE_ENV);
    if (billingProblem) ctx.addIssue({ code: 'custom', path: ['BILLING_PROVIDER'], message: billingProblem });
    for (const [prefix] of SOCIAL_PROVIDERS) {
      if (!e[`${prefix}_CLIENT_ID`] !== !e[`${prefix}_CLIENT_SECRET`]) {
        ctx.addIssue({ code: 'custom', path: [`${prefix}_CLIENT_ID`], message: `set both ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET, or neither` });
      }
    }
  });

export type Env = z.infer<typeof schema>;

/** Development: the repo's .env.local, then .env, as Next reads them. Earlier files and real env vars win. */
export function loadEnvFiles() {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(`${repoRoot}${file}`)) process.loadEnvFile(`${repoRoot}${file}`);
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
