# API App

NestJS backend for authentication, tenant management, chat operations, CRM, tickets, analytics, billing, notifications, and the Socket.IO gateway.

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
