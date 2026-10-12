# Restoring app.db from a snapshot

`app.db` holds accounts, sessions, plans, API keys, billing records and the job queue (`docs/architecture/backend.md` §12).

- **Snapshots:** the api writes one every night at 02:00 UTC, and at start-up if that UTC day has none yet.
  - They go to `APP_BACKUP_DIR` (default `data/backups/`) as `app-YYYY-MM-DD.db`. The newest `APP_BACKUP_KEEP` (default 14) are kept.
  - Each one passed `PRAGMA integrity_check` before it got its name.
- **Take one by hand** before anything risky, such as an upgrade or a manual SQL fix: `npm run backup -w @takip/api`. It works while the api runs, and replaces that day's snapshot.
- **Litestream** (§12.2) isn't set up yet, so a restore loses everything written since the snapshot.

Run the commands from the repo root. The paths are the defaults: use your `APP_DB_PATH` and `APP_BACKUP_DIR` if they're set.

## Steps

1. **Stop the api** (Ctrl-C on `npm run dev`, or stop its service). Nothing may hold `app.db` open while it's replaced.

2. **Choose a snapshot.** The newest is listed last:

   ```sh
   ls -l data/backups/
   ```

3. **Check it.** You should see `integrity ok, user_version N (this code migrates to M)`:

   ```sh
   npm run backup -w @takip/api -- check data/backups/app-2026-10-12.db
   ```

   - If the check fails, choose an older snapshot.
   - If N is greater than M, the snapshot came from newer code. Deploy that code first.
   - If N is less than M, that's fine: the api migrates it forward when it starts.

4. **Put it in place.** Move the current database aside together with its `-wal` and `-shm` files, then copy the snapshot in:

   ```sh
   aside=data/db/replaced-$(date -u +%Y%m%dT%H%M%SZ)
   mkdir -p "$aside"
   for f in data/db/app.db data/db/app.db-wal data/db/app.db-shm; do [ -e "$f" ] && mv "$f" "$aside/"; done
   cp data/backups/app-2026-10-12.db data/db/app.db
   ls data/db/
   ```

   `ls` must show no `app.db-wal` and no `app.db-shm`. SQLite would replay an old WAL into the restored file.

5. **Check the restored file.** It should report the same `user_version` as step 3:

   ```sh
   npm run backup -w @takip/api -- check data/db/app.db
   ```

6. **Start the api.** Its log should reach `listening on …` with no errors.

7. **Verify.**
   - Sign in on the map with an account that existed before the snapshot.
   - Open Account settings and check its plan.
   - `npm run admin -- list` should show the admins you expect.

8. **Clean up.** Once you're satisfied, delete the `replaced-…` folder. It holds password hashes.

## What a restore undoes

Everything after the snapshot's date (UTC) is undone:

- New accounts must sign up again.
- Users must sign in again on any device whose session started after the snapshot.
- Password changes, new API keys and plan grants are lost.
- Billing changes are lost too:
  - `billing.reconcile` refreshes the subscriptions the snapshot already holds.
  - Subscriptions started after the snapshot need their webhooks replayed from the provider.
- **Deleted accounts come back.** Before step 8, list the accounts deleted since the snapshot from the moved-aside database:

  ```sh
  sqlite3 "$aside/app.db" "SELECT subject_id, datetime(at / 1000, 'unixepoch') FROM audit_event WHERE action = 'user.delete' ORDER BY at"
  ```

  Delete them again. There's no admin button for that yet.

## Drill

Rehearse this once before launch, on a copy, never on the live database:

1. Set `APP_DB_PATH` and `APP_BACKUP_DIR` to a temporary folder.
2. Run steps 2 to 7 against it.

The api's tests run the same drill: `apps/api/src/db/backup.test.ts`, "the restore drill".
