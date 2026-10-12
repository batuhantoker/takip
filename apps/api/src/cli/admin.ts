import { userInfo } from 'node:os';
import { openAppDb } from '../db/app-db';
import { migrateAppSchema } from '../db/migrations';
import { loadEnv, loadEnvFiles } from '../env';

const USAGE = `Admin roles. Kept out of the web console on purpose, so it can't lock its own admins out.

  npm run admin -- list               who is an admin
  npm run admin -- promote <email>
  npm run admin -- demote <email>`;

const [command, email] = process.argv.slice(2);

loadEnvFiles();
const db = openAppDb(loadEnv().APP_DB_PATH);
migrateAppSchema(db);

function fail(message: string): never {
  console.error(message);
  db.close();
  process.exit(1);
}

const columns = (db.pragma('table_info(auth_user)') as { name: string }[]).map(c => c.name);
if (!columns.includes('role')) fail('The accounts tables are missing or older than the admin feature: start the api once (npm run dev).');

function setRole(role: 'admin' | 'user') {
  if (!email) fail(USAGE);
  const user = db.prepare('SELECT id, role FROM auth_user WHERE email = ?').get(email.toLowerCase()) as { id: string; role: string | null } | undefined;
  if (!user) fail(`No account uses ${email}.`);
  db.transaction(() => {
    db.prepare('UPDATE auth_user SET role = ? WHERE id = ?').run(role, user.id);
    db.prepare(`
      INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
      VALUES (?, 'admin', ?, 'user.role', 'user', ?, ?)`,
    ).run(Date.now(), `cli:${userInfo().username}`, user.id, JSON.stringify({ before: user.role ?? 'user', after: role }));
  })();
}

switch (command) {
  case 'list': {
    const admins = db.prepare("SELECT email, twoFactorEnabled FROM auth_user WHERE role = 'admin' ORDER BY email").all() as { email: string; twoFactorEnabled: number | null }[];
    if (!admins.length) console.log('No admins yet.');
    for (const a of admins) console.log(`${a.email}${a.twoFactorEnabled ? '' : '  (2FA off: the console stays closed until it is on)'}`);
    break;
  }
  case 'promote':
    setRole('admin');
    console.log(`${email} is an admin. Next:
  1. Turn on two-factor authentication: account menu → Account settings → Two-factor authentication.
  2. Open /admin and enter a code from your authenticator app.
The account menu shows the Admin link after you sign out and back in (or within 5 minutes).`);
    break;
  case 'demote':
    setRole('user');
    console.log(`${email} is no longer an admin. The console refuses them from their next request.`);
    break;
  default:
    console.log(USAGE);
}
db.close();
