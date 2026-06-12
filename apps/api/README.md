# API App

NestJS backend for authentication, tenant management, chat operations, CRM, tickets, analytics, billing, notifications, and the Socket.IO gateway.

## Current Foundation

The API foundation includes:

- NestJS application bootstrap
- Environment validation with Zod
- Global `api/v1` route prefix
- Helmet, compression, cookies, CORS, validation pipe, and structured errors
- Prisma service wired to the shared PostgreSQL schema
- Health endpoints
- Swagger documentation at `/docs`
- Jest unit and e2e test setup

Planned module boundaries:

- `auth`: JWT, refresh sessions, Google OAuth, password auth
- `organizations`: tenant setup, members, invitations, roles
- `chat`: conversations, messages, assignments, transfers, canned responses
- `visitors`: visitor sessions, page views, tracking events
- `crm`: contacts, notes, tags, contact timelines
- `tickets`: support tickets, comments, ticket activity
- `files`: upload policy, malware-safe metadata, storage abstraction
- `notifications`: email, in-app notifications, webhooks
- `billing`: Stripe customers, subscriptions, invoices, webhook handling
- `analytics`: reporting queries and metric rollups

## Commands

```bash
pnpm --filter @livechat/api dev
pnpm --filter @livechat/api build
pnpm --filter @livechat/api test
pnpm --filter @livechat/api test:e2e
pnpm --filter @livechat/api typecheck
```

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
