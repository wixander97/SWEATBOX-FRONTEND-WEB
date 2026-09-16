/**
 * Turning a backend failure into something a human can act on.
 *
 * The API answers in three different shapes depending on where the failure was
 * raised, and all three reach the browser:
 *
 * - a controller guard returns `{ message: "Coach is required" }`;
 * - the exception middleware returns the PascalCase envelope
 *   `{ Success, Message, Errors: [...] }`, where `Message` is the generic
 *   "An unexpected error occurred" and the sentence worth reading is in
 *   `Errors[0]`;
 * - ASP.NET's own model binding returns an RFC 7807 problem with a per-field
 *   `errors` dictionary.
 *
 * Everything here reads all three so a caller never has to care which one it
 * got.
 */

/** Per-field messages, keyed by the field name the backend used. */
export type FieldErrors = Record<string, string>;

export type NormalizedError = {
  message: string;
  fieldErrors?: FieldErrors;
};

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
  }
  return null;
}

function pick(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const found = firstString(record[key]);
    if (found) return found;
  }
  return null;
}

/**
 * Per-field messages out of a problem-details `errors` dictionary.
 *
 * The keys arrive PascalCase (`"FullName"`) because they are model property
 * names; they are lower-cased at the first letter so a form can look them up
 * under the field name it actually uses.
 */
function readFieldErrors(payload: unknown): FieldErrors | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const raw = record.errors ?? record.Errors;
  // The middleware's `Errors` is a flat list, not a dictionary — that one is a
  // message, not a field map.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const mapped: FieldErrors = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const message = firstString(value);
    if (!message) continue;
    const field = key.charAt(0).toLowerCase() + key.slice(1);
    mapped[field] = message;
  }
  return Object.keys(mapped).length ? mapped : undefined;
}

/** The status-code fallback, used when the body carries nothing readable. */
export function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "The request was rejected. Please check the values and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested record was not found.";
    case 409:
      return "This conflicts with existing data and cannot be saved.";
    case 422:
      return "Some values could not be processed. Please review the form.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The server could not complete the request. Please try again.";
    default:
      return status >= 400
        ? "The request failed. Please try again."
        : "Request failed";
  }
}

/**
 * The most specific sentence the payload offers, with the status as fallback.
 *
 * `Errors` is read before `Message` on purpose: when the exception middleware
 * wraps a validation failure, the useful sentence is the inner one and the
 * outer one is boilerplate.
 */
export function normalizeError(
  payload: unknown,
  status: number
): NormalizedError {
  const fieldErrors = readFieldErrors(payload);

  if (typeof payload === "string" && payload.trim()) {
    // A raw HTML error page is not a message; fall back to the status.
    const text = payload.trim();
    if (!text.startsWith("<")) {
      return { message: text, fieldErrors };
    }
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const generic = "An unexpected error occurred";

    const inner = pick(record, ["errors", "Errors"]);
    if (inner) return { message: inner, fieldErrors };

    const outer = pick(record, [
      "message",
      "Message",
      "error",
      "detail",
      "Detail",
      "title",
      "Title",
    ]);
    if (outer && outer !== generic) return { message: outer, fieldErrors };
    if (outer) return { message: messageForStatus(status), fieldErrors };
  }

  return { message: messageForStatus(status), fieldErrors };
}
