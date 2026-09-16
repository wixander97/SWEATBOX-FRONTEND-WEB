import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";
import { normalizeError } from "@/lib/api/errors";

/**
 * Server-side forwarding to the SWEATBOX API.
 *
 * Route handlers stay thin: the access token never leaves the httpOnly cookie,
 * and the browser only ever talks to same-origin `/api/...` paths. This is the
 * same arrangement the existing class and member routes use, lifted into one
 * place so a new resource is a four-line file rather than a copied block.
 */

export function unauthorized() {
  return NextResponse.json(
    { message: "Your session has expired. Please sign in again." },
    { status: 401 }
  );
}

type ForwardInit = {
  method?: string;
  /** Sent as JSON. Omit for GET/DELETE. */
  body?: unknown;
  /** Appended to the backend URL; blank and null values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
};

function buildUrl(path: string, query?: ForwardInit["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function call(path: string, init: ForwardInit, token: string) {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(buildUrl(path, init.query), {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
}

/**
 * Forwards a JSON call and mirrors the backend's status code.
 *
 * The status is passed through rather than collapsed, so the client can tell a
 * 403 from a 404 and show the right thing. The body is normalised to
 * `{ message }` on failure — see `normalizeError` for why that takes reading
 * three different shapes.
 */
export async function forwardJson(path: string, init: ForwardInit = {}) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  let res: Response;
  try {
    res = await call(path, init, token);
  } catch {
    return NextResponse.json(
      { message: "Could not reach the SWEATBOX API." },
      { status: 502 }
    );
  }

  if (res.status === 204) {
    return NextResponse.json({ ok: true });
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
    return NextResponse.json(
      { message, fieldErrors },
      { status: res.status }
    );
  }

  return NextResponse.json(payload ?? { ok: true });
}

/**
 * Forwards a file download (invoice and agreement PDFs).
 *
 * The bytes are streamed straight back with the backend's content type, so the
 * PDF the finance team keeps is the one the API rendered — nothing is built in
 * the browser.
 */
export async function forwardFile(
  path: string,
  fallbackFilename: string
) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Could not reach the SWEATBOX API." },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      /* keep the raw text */
    }
    const { message } = normalizeError(payload, res.status);
    return NextResponse.json({ message }, { status: res.status });
  }

  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        res.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition":
        res.headers.get("content-disposition") ??
        `inline; filename="${fallbackFilename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Reads the JSON body of a request, tolerating an empty one. */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Every search param of the incoming request, for pass-through filtering. */
export function queryFrom(req: Request): Record<string, string> {
  const entries = new URL(req.url).searchParams.entries();
  return Object.fromEntries(entries);
}
