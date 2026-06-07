import { AUTH_COOKIE_NAME } from "./constants";

const TOKEN_KEY = "sb_token";

/**
 * Reads the auth token from localStorage.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves the auth token to localStorage (client-readable).
 */
export function setAuthTokenLocal(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

/**
 * Clears the auth token from localStorage.
 */
export function clearAuthTokenLocal(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Wrapped fetch that auto-attaches Authorization: Bearer <token> header.
 * Only attaches if token exists and Authorization header is not already set.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let token: string | null = null;
  try {
    token = getAuthToken();
  } catch {
    // localStorage unavailable (SSR), proceed without token
  }

  const headers = new Headers(init?.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (token && !headers.has("X-Sb-Token")) {
    headers.set("X-Sb-Token", token);
  }

  const method = (init?.method ?? "GET").toUpperCase();
  if (
    ["POST", "PUT", "PATCH"].includes(method) &&
    !headers.has("Content-Type") &&
    init?.body &&
    typeof init.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return fetch(input, {
      ...init,
      headers,
    });
  } catch {
    // Network error — return a fake 401 so redirectToLoginIfUnauthorized can handle it
    return new Response(JSON.stringify({ message: "Network error" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}