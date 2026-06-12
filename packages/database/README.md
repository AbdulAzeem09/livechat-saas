# Database Package

The PostgreSQL schema is defined by raw SQL migrations under `prisma/migrations`. The Prisma schema mirrors the tables and enums for typed application access.

## Commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:validate
```

## Design Principles

- Every tenant-owned operational table includes `organization_id`.
- Durable chat events are persisted before realtime broadcasts.
- Visitor identity and CRM contacts are separate, then linked when the visitor is known.
- Billing is Stripe-oriented but stores enough local state for access control and admin reporting.
- Analytics use append-only operational data plus daily rollup tables for dashboard speed.
