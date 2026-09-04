import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

/**
 * Thin typed wrapper around `authFetch` for the Sweatbox backend.
 *
 * Every service under `lib/api/*` goes through here so components never call
 * `fetch`/`authFetch` directly. Follows the project convention of talking to
 * `API_BASE_URL` from the client with the bearer token attached by `authFetch`.
 */

export class ApiError extends Error {
  readonly status: number;
  /** Raw parsed body, when the backend returned one. */
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** True when the endpoint itself does not exist on this backend build. */
  get isNotImplemented(): boolean {
    return this.status === 404 || this.status === 405;
  }
}

export type RequestOptions = {
  signal?: AbortSignal;
  /**
   * Hard-redirect to /login on a 401. Defaults to `true`; background pollers
   * pass `false` so a transient auth blip does not kick staff out mid-payment.
   */
  redirectOn401?: boolean;
  /** Fallback message when the backend does not send one. */
  errorMessage?: string;
};

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/** What the API says when it has nothing useful to say. */
const GENERIC_BACKEND_MESSAGE = "an unexpected error occurred";

/**
 * The most useful sentence in an error body.
 *
 * The backend answers in two shapes and casings. A handled 400 is
 * `{ "message": "Membership plan is required." }`; an unhandled 500 is
 * `{ "Success": false, "Message": "An unexpected error occurred",
 *    "Errors": ["Unsupported AsteriPay payment method: CreditCard"] }` — where
 * the only sentence worth showing staff is inside `Errors`, and `Message` is
 * boilerplate. Keys are therefore matched case-insensitively and the array is
 * read first, otherwise a real reason like the one above reaches the front desk
 * as nothing but the caller's generic fallback.
 */
function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const at = (name: string): unknown => {
      const key = Object.keys(record).find((k) => k.toLowerCase() === name);
      return key === undefined ? undefined : record[key];
    };

    const errors = at("errors");
    if (Array.isArray(errors)) {
      const first = errors.find((e) => typeof e === "string" && e.trim());
      if (typeof first === "string") return first;
    }
    // ASP.NET ModelState: { errors: { Field: ["msg"] } }
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      const first = Object.values(errors as Record<string, unknown>).flat()[0];
      if (typeof first === "string" && first.trim()) return first;
    }

    for (const key of ["message", "title", "error", "detail"]) {
      const value = at(key);
      if (
        typeof value === "string" &&
        value.trim() &&
        value.trim().toLowerCase() !== GENERIC_BACKEND_MESSAGE
      ) {
        return value;
      }
    }
    // Nothing specific anywhere: the boilerplate still beats a made-up message.
    const message = at("message");
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof body === "string" && body.trim()) return body;
  return fallback;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { signal, redirectOn401 = true, errorMessage = "Request failed" } = options;

  const res = await authFetch(apiUrl(path), {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });

  if (res.status === 401) {
    if (redirectOn401) redirectToLoginIfUnauthorized(res.status);
    throw new ApiError("Unauthorized", 401);
  }

  const text = await res.text().catch(() => "");
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(messageFrom(parsed, errorMessage), res.status, parsed);
  }

  return parsed as T;
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>("GET", path, undefined, options);
}

export function apiPost<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>("POST", path, body, options);
}

export function apiPut<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>("PUT", path, body, options);
}

export function apiPatch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>("PATCH", path, body, options);
}

export function apiDelete<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>("DELETE", path, undefined, options);
}

/** Envelope shape used inconsistently across the Sweatbox endpoints. */
export type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  pageSize?: number;
  message?: string;
};

/** Normalize `T[]`, `{ items }` and `{ data }` responses to a plain array. */
export function toList<T>(payload: T[] | PagedResponse<T> | null | undefined): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items ?? payload.data ?? [];
}

export function errorMessageOf(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
