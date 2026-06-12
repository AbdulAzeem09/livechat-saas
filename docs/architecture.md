# Project Architecture

## Goals

- Provide a complete SaaS live chat product for businesses with multiple agents and teams.
- Keep tenant data isolated by `organization_id` throughout operational tables.
- Support real-time visitor and agent messaging through Socket.IO while storing every durable event in PostgreSQL.
- Keep billing, roles, analytics, tickets, CRM, and chat in one cohesive domain model for the first production release.
- Make the system deployable on a VPS with Docker and PostgreSQL.

## Monorepo

```text
apps/api
  NestJS modules, REST API, Socket.IO gateways, jobs, integrations
apps/web
  Next.js 15 app, dashboard, admin panel, widget runtime
packages/database
  Prisma schema and PostgreSQL migrations
packages/shared
  Shared DTOs, enums, validation schemas, event contracts
docs
  Architecture, API, install, deployment, and runbooks
```

## Backend Modules

| Module | Responsibility |
| --- | --- |
| Auth | JWT access tokens, refresh tokens, Google OAuth identities, session revocation |
| Organizations | Tenant lifecycle, members, invitations, departments, roles, permissions |
| Chat | Conversations, participants, messages, attachments, assignments, transfers |
| Realtime | Socket.IO gateways for agent and visitor channels |
| Visitors | Visitor profiles, sessions, page views, custom events |
| CRM | Contacts, tags, notes, contact timeline |
| Tickets | Ticket creation, assignment, comments, state changes |
| Canned Responses | Shared and department-scoped response snippets |
| Files | Upload metadata, storage abstraction, attachment policies |
| Notifications | Email, in-app notifications, webhook dispatch |
| Billing | Stripe customers, subscriptions, invoices, webhooks |
| Analytics | Daily rollups and reporting queries |
| Admin | Audit logs, API keys, webhook endpoints, organization controls |

## Frontend Areas

| Area | Responsibility |
| --- | --- |
| Agent Inbox | Live queue, assigned chats, transfer flow, canned responses, file sharing |
| Visitor Widget | Embeddable chat UI, visitor identity, message stream, upload controls |
| CRM | Contacts, notes, tags, chat history |
| Tickets | Ticket list, detail, comments, status transitions |
| Admin Panel | Members, roles, departments, widget settings, audit log |
| Analytics | Conversation volume, response times, satisfaction, agent performance |
| Billing | Plan, payment status, invoices, Stripe checkout/portal |

## Realtime Model

- Agents connect to `/agent` with a JWT and join rooms for their organization, departments, assigned conversations, and personal user channel.
- Visitors connect to `/visitor` with a widget public key and visitor session token.
- Messages are persisted first, then broadcast with idempotency keys so clients can reconcile optimistic sends.
- Read receipts, typing indicators, assignment changes, and transfer updates are emitted as separate events.

## Data Ownership

- `organizations` own all tenant-scoped records.
- `users` are global login identities.
- `user_organizations` represent organization memberships and agent state.
- Chat, CRM, ticket, notification, billing, and analytics records are tenant-scoped.
- Visitors may be linked to CRM contacts once identified by email or agent action.

## Deployment Shape

Initial production deployment will use:

- `web`: Next.js application container.
- `api`: NestJS application container.
- `postgres`: managed PostgreSQL or VPS-hosted PostgreSQL.
- `redis`: optional adapter for Socket.IO horizontal scaling and background queues.
- `nginx` or Caddy reverse proxy with TLS.

Docker and VPS instructions will be added in the deployment module.
