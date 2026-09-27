/**
 * HealthStream Authentication & Session Token Utilities
 * 
 * Provides unified authentication token synchronization between React state,
 * browser localStorage/sessionStorage, and API requests (Authorization: Bearer <token> & cookies).
 */

export interface AuthUser {
  username: string;
  userId?: string | number;
  role?: string;
}

const TOKEN_KEY = 'healthstream_auth_token';
const USER_KEY = 'healthstream_user';

/**
 * Retrieve the active authentication token from localStorage or sessionStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Persist the authentication token and user information
 */
export function setAuthToken(token: string, user?: AuthUser) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  } catch (e) {
    console.warn('Unable to persist auth state to storage:', e);
  }
}

/**
 * Retrieve cached user details
 */
export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clear all authentication tokens and cached user data
 */
export function clearAuth() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch (e) {
    console.warn('Unable to clear auth storage:', e);
  }
}

/**
 * Trigger unauthorized session cleanup and global logout event
 */
export function triggerUnauthorized() {
  if (typeof window === 'undefined') return;
  clearAuth();
  window.dispatchEvent(new CustomEvent('healthstream:unauthorized'));
}

/**
 * Return default API headers merged with Authorization: Bearer <token> if available
 */
export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch wrapper that attaches credentials: 'include' and Authorization Bearer token.
 * Automatically clears session and redirects on 401 Unauthorized responses.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const customHeaders = (options.headers as Record<string, string>) || {};
  const headers = getAuthHeaders(customHeaders);

  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (res.status === 401) {
      triggerUnauthorized();
    }

    return res;
  } catch (error) {
    throw error;
  }
}
