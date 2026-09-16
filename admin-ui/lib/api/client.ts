"use client";

import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import {
  messageForStatus,
  normalizeError,
  type FieldErrors,
} from "@/lib/api/errors";

/**
 * The browser-side call used by every admin screen.
 *
 * It answers two questions a component actually has — "did it work?" and "what
 * do I tell the user?" — instead of leaving each caller to re-derive them from
 * a `Response`. A 401 is handled here by sending the user to the login page,
 * because there is nothing a screen can usefully do with an expired session.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(message: string, status: number, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors ?? {};
  }

  /** Whether the failure was the backend refusing on permissions. */
  get isForbidden() {
    return this.status === 403;
  }

  /** Whether the failure was a business conflict rather than bad input. */
  get isConflict() {
    return this.status === 409;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /**
   * Leave the 401 to the caller instead of redirecting. Used by the session
   * probe, which runs before we know whether anyone is signed in.
   */
  allowUnauthenticated?: boolean;
  signal?: AbortSignal;
};

function withQuery(path: string, query?: RequestOptions["query"]) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Calls a same-origin route and returns the parsed body.
 *
 * Throws {@link ApiError} on any non-2xx so a caller can `try/catch` around a
 * submit and show one message, rather than threading an `ok` flag through.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query, allowUnauthenticated, signal } = options;

  let res: Response;
  try {
    res = await fetch(withQuery(path, query), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0
    );
  }

  if (res.status === 401 && !allowUnauthenticated) {
    redirectToLoginIfUnauthorized(res.status);
    throw new ApiError(messageForStatus(401), 401);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const { message, fieldErrors } = normalizeError(payload, res.status);
    const fromRoute =
      payload && typeof payload === "object"
        ? (payload as { fieldErrors?: FieldErrors }).fieldErrors
        : undefined;
    throw new ApiError(message, res.status, fromRoute ?? fieldErrors);
  }

  return payload as T;
}

/** The message to show for a thrown value, whatever it turned out to be. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/**
 * The shape a paged endpoint returns.
 *
 * `PagedResult<T>` on the backend is `{ items, totalCount, page, pageSize,
 * totalPages }`, but a few of the older list endpoints answer with a bare
 * array, so both are accepted.
 */
export type Paged<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalItems?: number;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  pageCount?: number;
};

export type PageInfo<T> = {
  items: T[];
  totalItems: number;
  totalPages: number;
};

/** Flattens either list shape into one the tables can render. */
export function readPage<T>(
  payload: Paged<T> | T[] | null | undefined,
  pageSize: number
): PageInfo<T> {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      totalItems: payload.length,
      totalPages: 1,
    };
  }
  if (!payload) {
    return { items: [], totalItems: 0, totalPages: 1 };
  }

  const items = payload.items ?? payload.data ?? [];
  const totalItems =
    payload.totalCount ?? payload.totalItems ?? payload.total ?? items.length;
  const totalPages =
    payload.totalPages ??
    payload.pageCount ??
    Math.max(1, Math.ceil(totalItems / (payload.pageSize || pageSize)));

  return { items, totalItems, totalPages: Math.max(1, totalPages) };
}

/**
 * Opens a PDF the backend rendered.
 *
 * The bytes come through the proxy route so the access token stays in the
 * httpOnly cookie — a plain `window.open` on the API URL would arrive
 * unauthenticated. Nothing is generated client-side.
 */
export async function openPdf(
  path: string,
  mode: "view" | "download",
  filename: string
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store" });
  } catch {
    throw new ApiError("Could not reach the server.", 0);
  }

  if (res.status === 401) {
    redirectToLoginIfUnauthorized(res.status);
    throw new ApiError(messageForStatus(401), 401);
  }

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      /* the body was not JSON */
    }
    const { message } = normalizeError(payload, res.status);
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (mode === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Revoked on a delay: revoking immediately can race the new tab's load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
