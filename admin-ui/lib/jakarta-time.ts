/**
 * Rendering backend instants (UTC) as Jakarta calendar dates and times.
 *
 * Unlike the wall-clock helpers in `lib/format.ts`, the drop-in and loyalty
 * endpoints return real UTC instants (`...Z`). They have to be converted to
 * Asia/Jakarta before display, otherwise a pass that ends at 23:59 Jakarta
 * shows the previous day for anyone whose browser is not on WIB.
 */

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Parses an API instant; a value with no offset is read as UTC. */
export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const date = new Date(hasZone || isDateOnly ? trimmed : `${trimmed}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-10-06T16:59:59Z` -> `06 Oct 2026` (Jakarta). */
export function jakartaDate(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date ? DATE_FMT.format(date) : "-";
}

/** `2026-10-06T03:15:00Z` -> `06 Oct 2026, 10:15` (Jakarta). */
export function jakartaDateTime(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date ? DATE_TIME_FMT.format(date) : "-";
}

/** A Jakarta date range, collapsed to one date when both ends fall on it. */
export function jakartaDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): string {
  const start = jakartaDate(from);
  const end = jakartaDate(to);
  if (start === "-") return end;
  if (end === "-" || start === end) return start;
  return `${start} → ${end}`;
}

const INPUT_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** An API instant as the Jakarta `yyyy-MM-dd` a date input shows. */
export function jakartaDateInput(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date ? INPUT_FMT.format(date) : "";
}

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaMidnightUtc(dateInput: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - JAKARTA_OFFSET_MS;
}

/** `2026-10-06` -> the UTC instant of 00:00 that day in Jakarta. */
export function jakartaDayStartUtc(dateInput: string): string | null {
  const ms = jakartaMidnightUtc(dateInput);
  return ms === null ? null : new Date(ms).toISOString();
}

/** `2026-10-06` -> the UTC instant of 23:59:59 that day in Jakarta. */
export function jakartaDayEndUtc(dateInput: string): string | null {
  const ms = jakartaMidnightUtc(dateInput);
  return ms === null ? null : new Date(ms + 24 * 60 * 60 * 1000 - 1000).toISOString();
}
