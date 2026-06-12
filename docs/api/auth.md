# Auth API

## Overview

The auth module supports:

- Email/password registration and login
- First organization creation during registration
- Owner role assignment during registration
- JWT access tokens
- Refresh-token rotation and revocation
- HTTP-only refresh-token cookie support
- Google OAuth URL and callback endpoints
- `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard`

## Register

```http
POST /api/v1/auth/register
```

Creates:

- `users` record
- `auth_provider_identities` password identity
- `organizations` record
- `roles` owner role
- `user_organizations` membership
- `user_roles` owner assignment
- `refresh_tokens` session record

Request:

```json
{
  "name": "Azeem Khan",
  "email": "owner@example.com",
  "password": "StrongPass123!",
  "organizationName": "Azeem Support",
  "organizationSlug": "azeem-support"
}
```

## Login

```http
POST /api/v1/auth/login
```

Verifies the password hash and returns an access token plus refresh token. The refresh token is also set as an HTTP-only cookie.

## Refresh

```http
POST /api/v1/auth/refresh
```

Accepts the refresh token from the HTTP-only cookie or request body, revokes the old refresh token, and issues a new access/refresh pair.

## Logout

```http
POST /api/v1/auth/logout
```

Revokes the active refresh token and clears the refresh-token cookie.

## Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

Returns the active user and organization memberships.

## Google Login

```http
GET /api/v1/auth/google/url
```

Returns a Google OAuth authorization URL.

```http
GET /api/v1/auth/google/callback?code=<code>&state=<state>
```

Exchanges the authorization code, creates or links a Google identity, and issues local JWT tokens.
