# ADR 0001: Architecture and Data Model

## Status

Accepted

## Context

The product needs to support multi-tenant SaaS live chat with multiple agents, real-time messaging, visitor tracking, CRM records, tickets, email notifications, Stripe billing, analytics, and role-based administration.

## Decision

Use a TypeScript monorepo with:

- Next.js 15 for the dashboard, admin panel, and visitor widget.
- NestJS for the API, domain modules, background jobs, and Socket.IO gateway.
- PostgreSQL as the system of record.
- Prisma Client for typed database access.
- Raw PostgreSQL migrations as the canonical database schema so advanced indexes, partial uniqueness, JSONB defaults, array fields, triggers, and tenant-scoped constraints are explicit.

## Consequences

- The API can evolve module by module without splitting the data model across services too early.
- PostgreSQL keeps strong consistency across chat, CRM, tickets, billing, and analytics data.
- Prisma gives application-level typing while the SQL migration remains the exact deployable schema.
- Future service extraction remains possible around chat realtime, billing, notifications, and analytics.
