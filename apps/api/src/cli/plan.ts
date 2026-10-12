import { userInfo } from 'node:os';
import { parseArgs } from 'node:util';
import { CATALOGUE } from '@takip/core/entitlements';
import { clearOverride, grantPlan, revokePlan, setOverride, setPlanValue, type Actor } from '../access/grants';
import { createAccess } from '../access/resolver';
import { openAppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { loadEnv, loadEnvFiles } from '../env';

const USAGE = `Plans and access, until the admin console exists.

  npm run plan -- plans                                   what each plan includes
  npm run plan -- show <email>                            a user's plan and entitlements
  npm run plan -- grant <email> <plan> [--until YYYY-MM-DD] [--reason "…"]
  npm run plan -- revoke <email> [--reason "…"]
  npm run plan -- set <plan> <key> <value>                change a plan for everyone on it
  npm run plan -- override <email> <key> <value> [--until YYYY-MM-DD] [--reason "…"]
  npm run plan -- unoverride <email> <key>

Values are JSON: true, 500, "paid".`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { until: { type: 'string' }, reason: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
});
const [command, ...args] = positionals;

loadEnvFiles();
const db = openAppDb(loadEnv().APP_DB_PATH);
migrateAppSchema(db);
const access = createAccess(db, { ttlMs: 0 });
const actor: Actor = { type: 'admin', id: `cli:${userInfo().username}` };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function userId(email: string | undefined) {
  if (!email) fail(USAGE);
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'auth_user'").get()) fail('No accounts yet: start the api once (npm run dev) so it creates its tables.');
  const id = db.prepare('SELECT id FROM auth_user WHERE email = ?').pluck().get(email.toLowerCase()) as string | undefined;
  return id ?? fail(`No account uses ${email}.`);
}

function until() {
  if (!values.until) return null;
  const at = Date.parse(`${values.until}T23:59:59Z`);
  return Number.isNaN(at) ? fail(`--until wants YYYY-MM-DD, not ${values.until}`) : at;
}

const date = (at: number | null) => (at === null ? 'no end date' : new Date(at).toISOString().slice(0, 10));
const applied = () => console.log('Done. A running api picks this up within a minute.');

try {
  switch (values.help ? undefined : command) {
    case 'plans': {
      const plans = ['anon', ...access.publicPlans().map(p => p.id)].map(access.plan);
      const width = Math.max(...Object.keys(CATALOGUE).map(k => k.length)) + 2;
      console.log(''.padEnd(width) + plans.map(p => p.id.padEnd(10)).join(''));
      for (const key of Object.keys(CATALOGUE) as (keyof typeof CATALOGUE)[]) {
        console.log(key.padEnd(width) + plans.map(p => String(p.entitlements[key]).padEnd(10)).join(''));
      }
      break;
    }
    case 'show': {
      const { plan, subscription, entitlements } = access.resolve({ type: 'user', id: userId(args[0]) });
      console.log(`${args[0]}: ${plan.name} (${plan.id})`);
      console.log(subscription ? `  via ${subscription.provider}, ${subscription.status}, ${date(subscription.until)}` : '  the default for signed-in users');
      for (const [key, value] of Object.entries(entitlements)) console.log(`  ${key.padEnd(24)}${value}`);
      break;
    }
    case 'grant':
      grantPlan(db, { userId: userId(args[0]), planId: args[1] ?? fail(USAGE), until: until(), actor, reason: values.reason });
      applied();
      break;
    case 'revoke':
      revokePlan(db, { userId: userId(args[0]), actor, reason: values.reason });
      applied();
      break;
    case 'set':
      if (args.length !== 3) fail(USAGE);
      setPlanValue(db, { planId: args[0], key: args[1], value: args[2], actor });
      applied();
      break;
    case 'override':
      if (args.length !== 3) fail(USAGE);
      setOverride(db, { userId: userId(args[0]), key: args[1], value: args[2], until: until(), actor, reason: values.reason });
      applied();
      break;
    case 'unoverride':
      if (args.length !== 2) fail(USAGE);
      clearOverride(db, { userId: userId(args[0]), key: args[1], actor });
      applied();
      break;
    default:
      console.log(USAGE);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  db.close();
}
