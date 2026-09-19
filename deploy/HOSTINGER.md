# Putting LiveChat live on a Hostinger VPS

Everything runs on one server: the website, the API, the live chat, PostgreSQL, Redis and
SSL. No Vercel, no Render, no Supabase needed.

## 1. Buy the right thing

Hostinger sells two very different products. **Web / Premium / Business Hosting will not
work** — that is for PHP sites, and this app needs a long-running Node server with open
websocket connections.

Buy **VPS Hosting (KVM)**:

| | |
|---|---|
| Plan | **KVM 2** (2 vCPU, 8 GB RAM) — KVM 1 works but builds are slow |
| Operating system | **Ubuntu 22.04 or 24.04**, plain |
| Template | **None.** Do not pick CyberPanel, cPanel or any "with panel" image |

Then point your domain at the server: in your DNS, an **A record** for `yourdomain.com`
pointing to the VPS IP address. Wait until `ping yourdomain.com` shows that IP.

## 2. Run one command

```bash
ssh root@YOUR_VPS_IP

curl -fsSL https://raw.githubusercontent.com/AbdulAzeem09/livechat-saas/master/deploy/hostinger-vps-setup.sh -o setup.sh
bash setup.sh yourdomain.com you@yourdomain.com
```

It takes roughly 10–15 minutes and does all of this:

- installs Node 20, PostgreSQL, Redis, nginx and PM2
- creates the database with a generated password
- clones the code, writes `.env` with freshly generated JWT secrets
- runs the migrations and builds both apps
- starts them under PM2 so they come back after a reboot
- puts nginx in front and gets a free Let's Encrypt certificate (https)
- closes the firewall to everything except SSH and the web
- schedules a **nightly database backup**, kept for 14 days

When it finishes it prints your database password. Write it down.

## 3. Add the two things it cannot generate

Open `/opt/livechat/.env` and fill in:

**Email** (so invitations and password resets are delivered). Use a sending service —
mail sent straight from a VPS lands in spam. Resend, Brevo and Postmark all have free tiers.

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=your-key
SMTP_FROM="Your Company <no-reply@yourdomain.com>"
```

Also add the SPF and DKIM DNS records your email provider gives you, or mail still lands
in spam.

**AI** (optional — summaries and tagging work without it, replies get smarter with it):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Then `pm2 restart all`.

## 4. Day-to-day

| What | Command |
|---|---|
| Is it running? | `pm2 status` |
| What went wrong? | `pm2 logs livechat-api --lines 100` |
| Restart after editing `.env` | `pm2 restart all` |
| Ship a new version | `bash /opt/livechat/deploy/hostinger-vps-update.sh` |
| Where are the backups? | `/var/backups/livechat/` |
| Restore a backup | `gunzip -c /var/backups/livechat/FILE.sql.gz \| sudo -u postgres psql livechat` |

## 5. When one server is no longer enough

Measured on a single laptop that was also running the database and the test tool, one API
instance held **500 visitors chatting at once with nothing dropped**. A VPS doing only this
will do better. In customer terms that is comfortably past 500 businesses.

When responses start feeling slow, this app is already built to spread out:

1. `REDIS_URL` is already set, so several API instances share one chat.
2. Start more: `pm2 scale livechat-api 3` (leave the web app as one).
3. After that, move PostgreSQL to its own server and put a load balancer in front.

Nothing in the code has to change for step 1 and 2 — that work is done.

## Things worth knowing

- **Attachments** are stored on the server's own disk (`FILE_STORAGE_DRIVER=local`). That is
  correct here: a VPS disk survives restarts. Include `/opt/livechat/apps/api/uploads` in
  your backups if customers upload a lot.
- **Payments**: `AUTHORIZENET_*` are not set by the script. Add them only when you are ready
  to charge real cards — production refuses to activate plans without a configured gateway.
- **Messaging channels** (WhatsApp, Messenger, Instagram) need their tokens pasted into
  Settings → Messaging channels inside the app, not into `.env`.
- **Keep `ALLOW_PRIVATE_NETWORK_URLS` unset.** It is a local-testing switch and is ignored in
  production anyway.
