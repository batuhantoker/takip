#!/usr/bin/env bash
# Builds origin/dev on this machine and runs it on the NUC. The NUC (7.5 GB) can't build TAKIP any more: since the
# public pages the compile alone needs about 6.5 GB, and on 2026-10-19 a build there froze it until a reboot.
#
#   tools/deploy-nuc.sh
#
# Build-time settings (NEXT_PUBLIC_*) come from the NUC's own .env.local and .env.production.local, copied into a
# throwaway worktree and deleted with it. The build is copied beside the running one, so the site is down only for
# the swap and the restart (and npm ci, when the lockfile changed).
set -euo pipefail

NUC=${NUC:-user@nuc}
REPO=$(git rev-parse --show-toplevel)

git -C "$REPO" fetch -q origin
SHA=$(git -C "$REPO" rev-parse origin/dev)
# .noindex keeps Spotlight out of node_modules.
WORK=$(mktemp -d)/takip-nuc.noindex
cleanup() { git -C "$REPO" worktree remove --force "$WORK" 2>/dev/null || rm -rf "$WORK"; }
trap cleanup EXIT

echo "Building ${SHA:0:7} in $WORK"
git -C "$REPO" worktree add -q --detach "$WORK" "$SHA"
scp -q "$NUC:takip/.env.local" "$NUC:takip/.env.production.local" "$WORK/"
(cd "$WORK" && nice npm ci --no-audit --no-fund --loglevel=error && nice npx next build)
# A path from this machine in the server code would break on the NUC.
if grep -rqF -e "$HOME" -e "$WORK" -e /var/folders -e /private/tmp "$WORK/.next/server"; then
  echo "The build refers to this machine's paths; not deploying." >&2
  exit 1
fi

# The checkout has to match the build: the server reads data/site and public/ from it, and the api runs from source.
OLD=$(ssh "$NUC" 'cd ~/takip && git rev-parse HEAD')
ssh "$NUC" "cd ~/takip && git pull -q --ff-only && test \"\$(git rev-parse HEAD)\" = $SHA" \
  || { echo "The NUC's checkout didn't land on ${SHA:0:7}; not deploying." >&2; exit 1; }

# Files unchanged since the running build are hard-linked from it; the rest use it as the basis for their delta.
rsync -a --delete --exclude cache --exclude standalone --link-dest=../.next "$WORK/.next/" "$NUC:takip/.next-new/"

echo "Switching the NUC from ${OLD:0:7} to ${SHA:0:7}"
ssh "$NUC" 'systemctl --user stop takip-web'
# Packages are reinstalled only when the lockfile changed, and never under running services.
if ! git -C "$REPO" diff --quiet "$OLD" "$SHA" -- package-lock.json; then
  ssh "$NUC" 'systemctl --user stop takip-api takip-ingest && cd ~/takip && npm ci --no-audit --no-fund --loglevel=error'
fi
# The server's own cache (fetches, images) moves across with the swap. If the swap fails, the old build comes back.
ssh "$NUC" 'cd ~/takip && rm -rf .next-old .next-new/cache && { [ ! -d .next/cache ] || mv .next/cache .next-new/cache; } && mv .next .next-old && mv .next-new .next' \
  || { ssh "$NUC" 'cd ~/takip && { [ -d .next ] || mv .next-old .next; } && systemctl --user start takip-web takip-api takip-ingest'
       echo "The swap failed; the NUC is back on the build it had." >&2; exit 1; }
# The api runs its migrations on start, so a deploy that adds one keeps a copy of the accounts database first.
if ! git -C "$REPO" diff --quiet "$OLD" "$SHA" -- apps/api/src/db/migrations.ts; then
  ssh "$NUC" 'cd ~/takip && npm run -s backup -w @takip/api'
fi
ssh "$NUC" 'systemctl --user start takip-web && systemctl --user restart takip-api takip-ingest && sleep 8 && systemctl --user is-active takip-web takip-api takip-ingest'
ssh "$NUC" 'rm -rf ~/takip/.next-old'
echo "takip.dev: $(curl -s -o /dev/null -w '%{http_code}' --max-time 60 https://takip.dev/)"
