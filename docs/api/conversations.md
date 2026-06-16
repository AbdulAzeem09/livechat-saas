# Conversations And Realtime API

## Overview

The conversations module is the first realtime chat core. It supports the authenticated agent-side workflow:

- List organization conversations
- Create manual conversations
- Send agent messages
- Read message history
- Update status, priority, subject, and metadata
- Assign or transfer a conversation to another agent
- Broadcast conversation and message changes over Socket.IO

All REST routes require:

- `Authorization: Bearer <access_token>`
- Active organization membership
- `chat:read` or `chat:write` permission

## REST Endpoints

```http
GET /api/v1/organizations/:organizationId/conversations
```

Query params:

- `status`: `QUEUED`, `OPEN`, `PENDING`, `RESOLVED`, `CLOSED`, `SPAM`
- `priority`: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- `assignedAgentId`: organization membership id
- `assignedToMe`: `true` to return only the current member's assigned conversations
- `limit`: `1` to `100`, default `25`

```http
POST /api/v1/organizations/:organizationId/conversations
```

Creates a manual conversation. If `assignedAgentId` is omitted, the current member is assigned.

```json
{
  "subject": "Checkout support",
  "priority": "NORMAL",
  "source": "MANUAL",
  "initialMessage": "Hi, I can help with this."
}
```

```http
GET /api/v1/organizations/:organizationId/conversations/:conversationId
PATCH /api/v1/organizations/:organizationId/conversations/:conversationId
```

Patch body example:

```json
{
  "status": "RESOLVED",
  "priority": "HIGH",
  "subject": "Billing question"
}
```

```http
POST /api/v1/organizations/:organizationId/conversations/:conversationId/assign
```

```json
{
  "assignedAgentId": "membership-uuid",
  "reason": "Escalating to billing specialist"
}
```

```http
GET /api/v1/organizations/:organizationId/conversations/:conversationId/messages
POST /api/v1/organizations/:organizationId/conversations/:conversationId/messages
```

Message body:

```json
{
  "body": "Thanks for waiting. I found the issue.",
  "type": "TEXT",
  "visibility": "PUBLIC",
  "idempotencyKey": "client-generated-key"
}
```

## Socket.IO Namespace

```text
/chat
```

Connect with JWT auth:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:4000/chat", {
  auth: {
    token: accessToken,
    organizationId
  }
});
```

The server validates the JWT, checks organization membership, checks `chat:read`, then joins:

- `organization:<organizationId>`
- `member:<membershipId>`

## Client Events

```text
conversation.join
conversation.leave
typing.update
```

Join one conversation:

```json
{
  "conversationId": "conversation-uuid"
}
```

Typing update:

```json
{
  "conversationId": "conversation-uuid",
  "isTyping": true
}
```

## Server Events

```text
chat.ready
chat.error
conversation.created
conversation.updated
conversation.assigned
message.created
typing.updated
```

`conversation.created`, `conversation.updated`, and `message.created` emit payloads shaped like the REST response DTOs.

## Next Work

This module currently covers authenticated agent realtime chat. The next module should add visitor/widget public conversation start and visitor message sending, scoped by widget public key and visitor session token.
