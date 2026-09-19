#!/usr/bin/env bash
# Ship a new version onto a server that setup.sh already prepared.
#
#   ssh root@YOUR_VPS_IP
#   bash /opt/livechat/deploy/hostinger-vps-update.sh
#
# Takes a database backup first, so a bad migration can be undone.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/livechat}"
BRANCH="${BRANCH:-master}"

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }

say "Backing the database up first"
mkdir -p /var/backups/livechat
BACKUP="/var/backups/livechat/before-update-$(date +%F-%H%M).sql.gz"
sudo -u postgres pg_dump livechat | gzip > "${BACKUP}"
echo "    ${BACKUP}"

say "Fetching ${BRANCH}"
cd "${APP_DIR}"
git fetch --all
git checkout "${BRANCH}"
git pull

say "Installing and building"
set -a
# shellcheck disable=SC1091
. "${APP_DIR}/.env"
set +a
pnpm install --frozen-lockfile
pnpm --filter @livechat/database db:generate
pnpm --filter @livechat/database db:deploy
pnpm build

say "Restarting"
pm2 restart livechat-api livechat-web --update-env
pm2 save

say "Done — checking the API answers"
sleep 3
curl -fsS http://127.0.0.1:4000/api/v1/health && echo

cat <<DONE

  Updated. If something looks wrong:

    pm2 logs livechat-api --lines 100     # what went wrong
    gunzip -c ${BACKUP} | sudo -u postgres psql livechat   # put the database back

DONE
