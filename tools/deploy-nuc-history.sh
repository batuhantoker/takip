#!/usr/bin/env bash
# Puts this machine's History on the NUC after imports: history.db, merged with what the NUC records itself.
# Run after tools/deploy-nuc.sh, so the NUC runs code that knows the new kinds.
#
#   tools/deploy-nuc-history.sh
#
# The NUC's catalog.db is never replaced (its ingest keeps tracks, runs and coverage there), and neither is its
# event-pages.db: that file is the ledger of every slug the live site has handed out, so the index is rebuilt there.
# The site is down while the services are stopped: about a minute.
set -euo pipefail

NUC=${NUC:-user@nuc}
REPO=$(git rev-parse --show-toplevel)
STAGE=.cache/deploy-data
SNAP=$(mktemp -d)
trap 'rm -rf "$SNAP"' EXIT

for db in history catalog; do nice sqlite3 "$REPO/data/db/$db.db" "VACUUM INTO '$SNAP/$db.mac.db'"; done
ssh "$NUC" "mkdir -p ~/takip/$STAGE"
rsync -a --partial --timeout=120 "$SNAP/history.mac.db" "$SNAP/catalog.mac.db" "$REPO/tools/deploy-nuc-history-merge.ts" "$NUC:takip/$STAGE/"

# On any failure the services come back on the data they had.
ssh "$NUC" "bash -s" <<EOF
set -euo pipefail
cd ~/takip
trap 'systemctl --user start takip-web takip-api takip-ingest' EXIT
systemctl --user stop takip-web takip-api takip-ingest
BACKUP=$STAGE/backup-\$(date +%Y%m%d-%H%M)
mkdir -p \$BACKUP
cp -p data/db/catalog.db* data/db/event-pages.db \$BACKUP/ 2>/dev/null || true
nice npx tsx $STAGE/deploy-nuc-history-merge.ts $STAGE
test ! -e $STAGE/history.mac.db-wal
for f in history.db history.db-wal history.db-shm; do if [ -e data/db/\$f ]; then mv data/db/\$f \$BACKUP/; fi; done
mv $STAGE/history.mac.db data/db/history.db
rm -f $STAGE/catalog.mac.db
nice npx tsx tools/site/build-event-pages.ts | tail -1
# Two backups are kept; each holds a whole history.db.
ls -dt $STAGE/backup-* | tail -n +3 | xargs rm -rf
EOF
sleep 8
ssh "$NUC" 'systemctl --user is-active takip-web takip-api takip-ingest'
echo "takip.dev: $(curl -s -o /dev/null -w '%{http_code}' --max-time 60 https://takip.dev/)"
