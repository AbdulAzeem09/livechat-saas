# Organizations API

## Overview

The organizations module manages tenant profile data, members, invitations, custom roles, and role assignments.

All `/:organizationId` routes use:

- JWT authentication
- DB-backed membership verification
- Permission checks from the user's organization roles

## Implemented Endpoints

```http
GET /api/v1/organizations
```

Lists organizations for the current authenticated user.

```http
GET /api/v1/organizations/:organizationId
PATCH /api/v1/organizations/:organizationId
```

Reads or updates organization profile fields.

```http
GET /api/v1/organizations/:organizationId/members
PATCH /api/v1/organizations/:organizationId/members/:membershipId
```

Lists and updates organization memberships and agent status.

```http
GET /api/v1/organizations/:organizationId/invitations
POST /api/v1/organizations/:organizationId/invitations
```

Lists and creates member invitations. Email delivery will be wired in the notifications module.

```http
GET /api/v1/organizations/:organizationId/roles
POST /api/v1/organizations/:organizationId/roles
PATCH /api/v1/organizations/:organizationId/roles/:roleId
DELETE /api/v1/organizations/:organizationId/roles/:roleId
```

Manages custom roles. System roles cannot be edited or deleted.

```http
POST /api/v1/organizations/:organizationId/members/:membershipId/roles/:roleId
DELETE /api/v1/organizations/:organizationId/members/:membershipId/roles/:roleId
```

Assigns or revokes roles for a member.

## Permissions

- `organization:read`: read organization details
- `organization:update`: update organization profile
- `members:manage`: list/update members and create invitations
- `roles:manage`: manage roles and assignments
