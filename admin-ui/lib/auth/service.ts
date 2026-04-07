import { API_BASE_URL } from "./constants";
import type {
  AuthApiFailure,
  AuthApiSuccess,
  LoginRequest,
  RegisterRequest,
} from "./types";

const TOKEN_KEYS = ["token", "accessToken", "access_token", "jwt"] as const;

function getErrorMessage(payload: unknown): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const k of ["message", "error", "title", "detail"]) {
      const value = record[k];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "Request failed";
}

function findToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of TOKEN_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = findToken(value);
      if (nested) return nested;
    }
  }
  return null;
}

async function postJson(path: string, body: unknown): Promise<{
  status: number;
  ok: boolean;
  payload: unknown;
}> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = await response.text();
  }

  return { status: response.status, ok: response.ok, payload };
}

export async function loginWithApi(
  payload: LoginRequest
): Promise<AuthApiSuccess | AuthApiFailure> {
  const result = await postJson("/api/v1/auth/login", payload);
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: getErrorMessage(result.payload),
    };
  }
  const token = findToken(result.payload);
  if (!token) {
    return { ok: false, status: 500, error: "Token not found in response" };
  }
  return { ok: true, token, raw: result.payload };
}

export async function registerWithApi(
  payload: RegisterRequest
): Promise<{ ok: true } | AuthApiFailure> {
  const result = await postJson("/api/v1/auth/register", payload);
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: getErrorMessage(result.payload),
    };
  }
  return { ok: true };
}
