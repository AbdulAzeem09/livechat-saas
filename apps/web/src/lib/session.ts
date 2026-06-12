import type { AuthResponse, AuthUser } from "./types";

const SESSION_KEY = "livechat.session";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  createdAt: string;
}

export function saveSession(auth: AuthResponse): StoredSession {
  const session: StoredSession = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    user: auth.user,
    createdAt: new Date().toISOString()
  };

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function readSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredSession;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
