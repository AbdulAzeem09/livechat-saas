# LiveChat SaaS

A production-oriented SaaS live chat platform inspired by LiveChat.com. The product is structured as a TypeScript monorepo with a Next.js web app, NestJS API, PostgreSQL database, Socket.IO realtime gateway, JWT and Google authentication, Stripe billing, and Docker-based deployment.

## Module Plan

1. Project architecture and database design
2. API foundation, authentication, and authorization
3. Realtime chat domain and Socket.IO gateway
4. Agent dashboard and visitor chat widget
5. CRM, tickets, canned responses, file sharing, and notifications
6. Admin, analytics, billing, tests, Docker, and deployment guide

## Workspace Layout

```text
apps/
  api/                 NestJS backend application
  web/                 Next.js 15 frontend application
packages/
  database/            PostgreSQL schema, Prisma model, and migrations
  shared/              Shared TypeScript contracts and utilities
docs/
  api/                 API documentation
  adr/                 Architecture decision records
```

## First Module

This initial module defines the system architecture and database model. The canonical PostgreSQL schema lives in `packages/database/prisma/migrations/000001_initial_schema/migration.sql`, while `packages/database/prisma/schema.prisma` mirrors the data model for application typing.

## Local Development

Install dependencies:

```bash
pnpm install
```

Run the API:

```bash
pnpm --filter @livechat/api dev
```

Useful local URLs:

- API liveness: `http://localhost:4000/api/v1/health/live`
- API readiness: `http://localhost:4000/api/v1/health/ready`
- Swagger docs: `http://localhost:4000/docs`

Current implemented backend areas:

- API foundation and health probes
- Auth registration, login, refresh, logout, Google OAuth endpoints, and `/auth/me`
- Organization profile, members, invitations, roles, and role assignments
