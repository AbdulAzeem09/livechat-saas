# API Foundation

## Runtime

The backend is a NestJS application under `apps/api`.

Default local values:

- Port: `4000`
- Global prefix: `/api/v1`
- Swagger UI: `/docs`
- OpenAPI JSON: `/docs/openapi.json`

## Environment

The app validates environment variables at startup with Zod. Defaults are provided for local development, while production deployments should provide explicit values for secrets, URLs, CORS origins, database, email, Google OAuth, and Stripe.

`DATABASE_CONNECT_ON_STARTUP=false` lets the API boot locally even when PostgreSQL is not running. The readiness endpoint still checks the database and returns `503` when PostgreSQL is unavailable.

## Middleware and Global Behavior

- Request IDs are generated or preserved from `x-request-id`.
- Helmet sets secure HTTP headers.
- Compression is enabled.
- Cookie parsing is enabled for refresh-token flows.
- CORS is configured from `API_CORS_ORIGINS`.
- ValidationPipe strips unknown DTO fields and rejects extra fields.
- Global exception filtering returns a consistent JSON error body.

## Health Probes

```http
GET /api/v1/health/live
```

Returns process health and metadata.

```http
GET /api/v1/health/ready
```

Checks PostgreSQL with `SELECT 1`.
