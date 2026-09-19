#!/usr/bin/env bash
# One-time setup of a fresh Hostinger VPS (Ubuntu 22.04/24.04) to run LiveChat.
#
#   ssh root@YOUR_VPS_IP
#   curl -fsSL https://raw.githubusercontent.com/AbdulAzeem09/livechat-saas/master/deploy/hostinger-vps-setup.sh -o setup.sh
#   bash setup.sh yourdomain.com you@yourdomain.com
#
# Everything lands on this one machine: the API, the website, PostgreSQL, Redis and nginx
# with a free SSL certificate. Nothing else needs to be bought.
set -euo pipefail

DOMAIN="${1:?Usage: bash setup.sh <domain> <email-for-ssl>}"
SSL_EMAIL="${2:?Usage: bash setup.sh <domain> <email-for-ssl>}"
REPO="${REPO:-https://github.com/AbdulAzeem09/livechat-saas.git}"
BRANCH="${BRANCH:-master}"
APP_DIR="/opt/livechat"
DB_NAME="livechat"
DB_USER="livechat"

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }

say "Checking this is a fresh Ubuntu server"
if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (ssh root@your-vps-ip)." >&2
  exit 1
fi

say "Installing Node 20, PostgreSQL, Redis, nginx"
apt-get update -y
apt-get install -y curl git ufw nginx postgresql postgresql-contrib redis-server
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate
npm install -g pm2

say "Creating the database"
DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

say "Fetching the code"
mkdir -p "${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" fetch --all && git -C "${APP_DIR}" checkout "${BRANCH}" && git -C "${APP_DIR}" pull
else
  git clone --branch "${BRANCH}" "${REPO}" "${APP_DIR}"
fi
cd "${APP_DIR}"

say "Writing the settings file"
# Secrets are generated here so nobody has to invent them, and they never leave this server.
JWT_ACCESS="$(openssl rand -hex 32)"
JWT_REFRESH="$(openssl rand -hex 32)"
cat > "${APP_DIR}/.env" <<ENV
NODE_ENV=production
PORT=4000
APP_URL=https://${DOMAIN}
API_URL=https://${DOMAIN}
API_GLOBAL_PREFIX=api/v1
API_CORS_ORIGINS=https://${DOMAIN}
SOCKET_IO_CORS_ORIGIN=https://${DOMAIN}
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api/v1

DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public
REDIS_URL=redis://127.0.0.1:6379

JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
AUTH_COOKIE_SECURE=true

# Attachments live on this server's disk, which survives restarts (unlike Render).
FILE_STORAGE_DRIVER=local

# Fill these in when you have them — the app runs without them.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="LiveChat <no-reply@${DOMAIN}>"
ANTHROPIC_API_KEY=
SUPER_ADMIN_EMAILS=
ENV
chmod 600 "${APP_DIR}/.env"
cp "${APP_DIR}/.env" "${APP_DIR}/apps/api/.env"
cp "${APP_DIR}/.env" "${APP_DIR}/apps/web/.env"

say "Installing packages and building (a few minutes)"
# Prisma and Next read their settings from the environment, not from a parent .env.
set -a
# shellcheck disable=SC1091
. "${APP_DIR}/.env"
set +a
cp "${APP_DIR}/.env" "${APP_DIR}/packages/database/.env"
pnpm install --frozen-lockfile
pnpm --filter @livechat/database db:generate
pnpm --filter @livechat/database db:deploy
pnpm build

say "Starting the app with PM2 (restarts on reboot)"
pm2 delete livechat-api livechat-web 2>/dev/null || true
cd "${APP_DIR}/apps/api" && pm2 start "node dist/main.js" --name livechat-api --update-env
cd "${APP_DIR}/apps/web" && pm2 start "node node_modules/next/dist/bin/next start -p 3000" --name livechat-web --update-env
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

say "Pointing ${DOMAIN} at the app"
cat > /etc/nginx/sites-available/livechat <<NGINX
server {
  listen 80;
  server_name ${DOMAIN};
  client_max_body_size 25m;

  # The API and the live chat socket
  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    include /etc/nginx/proxy_params;
  }
  location /chat/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    include /etc/nginx/proxy_params;
    proxy_read_timeout 1h;
  }

  # Everything else is the website and dashboard
  location / {
    proxy_pass http://127.0.0.1:3000;
    include /etc/nginx/proxy_params;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/livechat /etc/nginx/sites-enabled/livechat
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "Turning on HTTPS"
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect || \
  echo "SSL failed — check that ${DOMAIN}'s A record points at this server, then run: certbot --nginx -d ${DOMAIN}"

say "Locking the firewall down"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

say "Setting up a nightly database backup (kept for 14 days)"
mkdir -p /var/backups/livechat
cat > /etc/cron.daily/livechat-backup <<'CRON'
#!/usr/bin/env bash
set -euo pipefail
STAMP="$(date +%F)"
sudo -u postgres pg_dump livechat | gzip > "/var/backups/livechat/livechat-${STAMP}.sql.gz"
find /var/backups/livechat -name 'livechat-*.sql.gz' -mtime +14 -delete
CRON
chmod +x /etc/cron.daily/livechat-backup
/etc/cron.daily/livechat-backup

say "Done"
cat <<DONE

  Your LiveChat is live:  https://${DOMAIN}

  Database password (write this down): ${DB_PASSWORD}
  Settings file:                       ${APP_DIR}/.env
  Nightly backups:                     /var/backups/livechat

  Useful commands:
    pm2 status            what is running
    pm2 logs livechat-api last errors
    pm2 restart all       restart after changing .env

  Still to do when you have them: SMTP details (so invitation and password
  emails are delivered) and ANTHROPIC_API_KEY (for the AI features).
  Add them to ${APP_DIR}/.env, then: pm2 restart all

DONE
