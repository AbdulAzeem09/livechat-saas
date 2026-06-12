# Product Feature Scope and Roadmap

This project targets a full SaaS live chat platform inspired by LiveChat.com. This document is the product contract for what will be built, in what order, and how each feature group maps to implementation modules.

## Status Legend

| Status | Meaning |
| --- | --- |
| Complete | Implemented, verified, and committed |
| In Progress | Currently being built |
| Planned | Accepted in scope, not started |
| Later | Accepted in scope, scheduled after core product |

## Current Build Status

| Area | Status | Commit |
| --- | --- | --- |
| Architecture and database design | Complete | `346cafe` |
| API foundation | Complete | `38f6146` |
| Auth and Google login endpoints | Complete | `7293f38` |
| Organization, members, invitations, roles | Complete | `9a4f755` |
| Expanded product scope | Complete | `3350def` |
| Frontend dashboard shell | Planned | - |
| Realtime chat and widget | Planned | - |
| Advanced LiveChat-style features | Planned | - |

## Release Strategy

The full product is large, so the build is split into releases. Each release should be usable and testable before the next one starts.

| Release | Goal | Main Outcome |
| --- | --- | --- |
| V1 Core SaaS | Auth, org management, frontend shell, live chat basics | A business can sign up, add agents, install widget, and chat with visitors |
| V2 Support Suite | Productivity, CRM, tickets, notifications, transcripts | Teams can manage support work beyond live conversations |
| V3 Growth and Analytics | Engagement, customization, reporting, ecommerce | Teams can optimize sales/support performance |
| V4 Channels and Platform | External channels, integrations, APIs, SDKs | Product becomes an extensible communication hub |
| V5 Enterprise and AI | AI, supervision, scheduler, security, compliance, SSO | Product supports advanced and enterprise customers |

## Immediate Next Step

Build the Next.js frontend shell:

- Login page
- Register page
- Auth session storage
- Dashboard layout
- Organization switcher placeholder
- Sidebar navigation for future modules
- API client wired to the existing NestJS auth and organization APIs

This comes before realtime chat so we have a usable UI surface for testing agent workflows.

## V1 Core SaaS Scope

| Feature | Status | Backend | Frontend |
| --- | --- | --- | --- |
| User registration | Complete | Auth module | Pending |
| Login/logout | Complete | Auth module | Pending |
| JWT refresh sessions | Complete | Auth module | Pending |
| Google login endpoints | Complete | Auth module | Pending |
| Organizations | Complete | Organizations module | Pending |
| Members and roles | Complete | Organizations module | Pending |
| Agent dashboard shell | Planned | Existing APIs | Pending |
| Visitor chat widget | Planned | Widget/chat APIs | Pending |
| Realtime messaging | Planned | Socket.IO gateway | Pending |
| Multiple agents | Planned | Queue/assignment APIs | Pending |
| Chat history | Planned | Conversations/messages APIs | Pending |
| Chat transfer | Planned | Transfer APIs | Pending |
| Basic canned responses | Planned | Canned response APIs | Pending |
| Basic file sharing | Planned | Upload/attachment APIs | Pending |

## Chat Tools

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Message sneak-peek | P1 | V2 | Realtime visitor typing preview |
| Canned responses | P0 | V1 | Agent productivity module |
| Chat tags | P0 | V1 | Conversation metadata and search |
| Rich messages | P1 | V2 | Structured message payloads and renderer |
| File sharing | P0 | V1 | Upload service and message attachments |
| Chat archives | P0 | V1 | Conversation history and search |
| Inactivity messages | P1 | V2 | Automation and visitor engagement |
| Notifications | P0 | V2 | Email, in-app, browser, and webhook notifications |
| Chat transfer | P0 | V1 | Conversation assignment and transfer workflow |
| Chat ratings | P1 | V2 | Satisfaction survey and analytics |

## Messaging Channels

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Chat widget | P0 | V1 | Embeddable visitor widget |
| Email | P1 | V2 | Email inbox and ticket conversion |
| Chat page | P1 | V2 | Hosted public chat page |
| WhatsApp Business | P2 | V4 | Channel integration module |
| SMS | P2 | V4 | Channel integration module |
| Facebook | P2 | V4 | Channel integration module |
| Instagram for Business | P2 | V4 | Channel integration module |
| Apple Messages for Business | P3 | V4 | Channel integration module |
| Voice, video, screen-sharing | P3 | V4 | Third-party calling integration layer |

## Widget Customization

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Chat window themes | P1 | V3 | Widget customization settings |
| Agent profiles | P1 | V3 | Agent profile management |
| Accessibility | P0 | V1 | Widget and dashboard UI requirements |
| Languages | P1 | V3 | Localization and translation settings |
| Chat boosters | P2 | V3 | Engagement and conversion widgets |

## Reports and Analytics

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Data summary | P1 | V3 | Analytics dashboard |
| Chat reports | P1 | V3 | Conversation reporting |
| Data export | P2 | V3 | CSV/API export jobs |
| Agent reports | P1 | V3 | Agent performance metrics |
| Customer reports | P2 | V3 | Visitor/contact analytics |
| Ecommerce reports | P2 | V3 | Sales and ecommerce tracking |
| Filters | P1 | V3 | Report query builder |
| Dashboard | P1 | V3 | Admin and manager dashboard |

## Sales and Ecommerce

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Customer data | P1 | V2 | CRM and visitor tracking |
| Product cards | P2 | V3 | Rich messages and ecommerce catalog integration |
| Ecommerce integrations | P2 | V3 | Integrations module |
| Goals and sales tracker | P2 | V3 | Conversion tracking and analytics |

## Integrations and APIs

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Webhooks | P1 | V4 | Webhook endpoint management and delivery jobs |
| Chat widget JS API | P1 | V4 | Widget JavaScript API |
| Chat API | P1 | V4 | Public REST/realtime API |
| Reports API | P2 | V4 | Analytics API |
| Customer SDK | P2 | V4 | Public SDK package |
| 200+ integrations foundation | P3 | V4 | Integration marketplace architecture |

## AI Features

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| AI reply suggestions | P2 | V5 | Agent assistant module |
| AI message improvement | P2 | V5 | Composer assistant |
| AI conversation summaries | P2 | V5 | Chat history and CRM timeline |
| AI support automation | P3 | V5 | Bot/automation module |

## Customer Engagement

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Targeted messages | P2 | V3 | Visitor segmentation and campaigns |
| Eye-catchers | P2 | V3 | Widget engagement assets |
| Chat buttons | P2 | V3 | Embeddable CTA buttons |
| Routing rules | P1 | V2 | Assignment and department routing |
| Availability | P1 | V2 | Business hours and agent availability |
| Chat assignment | P0 | V1 | Queue and assignment engine |
| Chat history | P0 | V1 | Conversation history |
| Chat transcripts | P1 | V2 | Email/export transcript service |

## Team Management

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Agent accounts | P0 | V1 | Member management |
| Groups | P1 | V2 | Departments/teams |
| Chat supervision | P2 | V5 | Manager monitoring and takeover |
| Agent roles | P0 | V1 | Role management |
| Chat limit | P1 | V2 | Agent capacity routing |
| Work scheduler | P2 | V5 | Availability and schedule module |

## Security

| Feature | Priority | Release | Planned Module |
| --- | --- | --- | --- |
| Encryption | P0 | V1 | TLS, secrets, password hashing, token security |
| Credit card masking | P2 | V5 | Message redaction pipeline |
| Data storage controls | P2 | V5 | Deployment and retention settings |
| Access restriction | P1 | V2 | RBAC, IP allowlists, audit logs |
| Visitor banning | P2 | V5 | Visitor security controls |
| Logging in with Google | P0 | V1 | Auth module |
| Compliance | P3 | V5 | Audit, retention, export, deletion tools |
| Single sign-on | P3 | V5 | Enterprise auth module |

## Detailed Build Order

1. Frontend shell and auth UI.
2. Agent dashboard layout and organization settings UI.
3. Chat domain APIs: conversations, participants, messages, tags.
4. Socket.IO realtime gateway for agents and visitors.
5. Visitor chat widget with install snippet.
6. Agent inbox: queues, assigned chats, message composer, chat history.
7. Chat transfer, assignment, availability, and agent capacity.
8. Canned responses, file sharing, rich messages, ratings, archives.
9. Visitor tracking, CRM contacts, tickets, transcripts.
10. Notifications: email, browser, in-app, webhooks.
11. Widget customization, languages, accessibility hardening, boosters.
12. Reports, analytics, filters, exports, goals, ecommerce tracking.
13. Channels: email, WhatsApp, SMS, Facebook, Instagram, chat page.
14. Public APIs, SDKs, widget JS API, integrations foundation.
15. AI assistant features, supervision, scheduler, enterprise security, SSO.

## Definition of Done

Every module should include:

- Database model or migration changes when needed.
- NestJS module, DTOs, services, controllers, guards, and Swagger docs.
- Frontend screens or components when user-facing.
- Unit or e2e tests for important behavior.
- Clear API documentation.
- Separate git commit.
- No broken `pnpm build`, `pnpm typecheck`, `pnpm lint`, or `pnpm test`.

## Non-Negotiables

- Multi-tenant data must stay scoped by `organization_id`.
- Realtime messages must be persisted before broadcast.
- Visitor widget must remain lightweight and mobile responsive.
- Agent dashboard must be efficient for repeated daily use.
- Admin and analytics screens should be dense, scan-friendly, and professional.
- Public APIs and webhooks must be versioned.
- Security-sensitive actions must be auditable.
