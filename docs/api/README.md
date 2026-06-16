# API Documentation

Detailed OpenAPI documentation will be added as the NestJS modules are implemented.

Initial API groups:

- Auth and Google OAuth
- Organization, members, roles, and invitations
- Conversations, messages, assignment, and Socket.IO chat events
- Visitor tracking and chat widget bootstrap
- Transfers, canned responses, and chat tools
- Contacts, tags, notes, tickets, and comments
- File upload signing and attachment metadata
- Notifications and webhooks
- Stripe billing and subscription management
- Analytics reporting

Realtime Socket.IO namespaces:

- `/chat`: authenticated agent dashboard events
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
| GET | `/api/v1/organizations` | Current user's organizations |
| GET | `/api/v1/organizations/:organizationId` | Organization details |
| PATCH | `/api/v1/organizations/:organizationId` | Update organization |
| GET | `/api/v1/organizations/:organizationId/members` | Organization members |
| PATCH | `/api/v1/organizations/:organizationId/members/:membershipId` | Update member |
| GET | `/api/v1/organizations/:organizationId/invitations` | Organization invitations |
| POST | `/api/v1/organizations/:organizationId/invitations` | Create invitation |
| GET | `/api/v1/organizations/:organizationId/roles` | Organization roles |
| POST | `/api/v1/organizations/:organizationId/roles` | Create custom role |
| PATCH | `/api/v1/organizations/:organizationId/roles/:roleId` | Update custom role |
| DELETE | `/api/v1/organizations/:organizationId/roles/:roleId` | Delete custom role |
| POST | `/api/v1/organizations/:organizationId/members/:membershipId/roles/:roleId` | Assign role |
| DELETE | `/api/v1/organizations/:organizationId/members/:membershipId/roles/:roleId` | Revoke role |
| GET | `/api/v1/organizations/:organizationId/conversations` | List conversations |
| POST | `/api/v1/organizations/:organizationId/conversations` | Create manual conversation |
| GET | `/api/v1/organizations/:organizationId/conversations/:conversationId` | Get conversation |
| PATCH | `/api/v1/organizations/:organizationId/conversations/:conversationId` | Update conversation |
| POST | `/api/v1/organizations/:organizationId/conversations/:conversationId/assign` | Assign conversation |
| GET | `/api/v1/organizations/:organizationId/conversations/:conversationId/messages` | List messages |
| POST | `/api/v1/organizations/:organizationId/conversations/:conversationId/messages` | Send agent message |

Swagger UI is available at `/docs` when the API server is running.
