# API Documentation

Detailed OpenAPI documentation will be added as the NestJS modules are implemented.

Initial API groups:

- Auth and Google OAuth
- Organization, members, roles, and invitations
- Visitor tracking and chat widget bootstrap
- Conversations, messages, transfers, and canned responses
- Contacts, tags, notes, tickets, and comments
- File upload signing and attachment metadata
- Notifications and webhooks
- Stripe billing and subscription management
- Analytics reporting

Realtime Socket.IO namespaces:

- `/agent`: authenticated agent dashboard events
- `/visitor`: public widget events scoped by widget key and visitor session

## Implemented Foundation Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/health` | Basic API liveness metadata |
| GET | `/api/v1/health/live` | Liveness probe for process health |
| GET | `/api/v1/health/ready` | Readiness probe that checks PostgreSQL |
| POST | `/api/v1/auth/register` | Create first user and organization |
| POST | `/api/v1/auth/login` | Email/password login |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/auth/me` | Current authenticated user |
| GET | `/api/v1/auth/google/url` | Google OAuth authorization URL |
| GET | `/api/v1/auth/google/callback` | Google OAuth callback |

Swagger UI is available at `/docs` when the API server is running.
