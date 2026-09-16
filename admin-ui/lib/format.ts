/**
 * Display and wire formatting shared by the admin screens.
 *
 * The timezone handling here is the important part. The API stores instants in
 * UTC but hands the admin portal *Jakarta wall-clock* values for the fields a
 * human typed — a workout's publish moment comes back as the time that was
 * entered, already converted. Re-interpreting those through the browser's own
 * timezone would shift them, so they are parsed and rendered as plain wall
 * clock and never passed through `Date`'s local conversion.
 */

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return IDR.format(value);
}

/** `2026-09-17T06:00:00` -> `17 Sep 2026`, with no timezone shift. */
export function formatDate(value: string | null | undefined): string {
  const parts = splitWallClock(value);
  if (!parts) return "-";
  const { year, month, day } = parts;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** `2026-09-17T06:00:00` -> `17 Sep 2026, 06:00`. */
export function formatDateTime(value: string | null | undefined): string {
  const parts = splitWallClock(value);
  if (!parts) return "-";
  const { year, month, day, hour, minute } = parts;
  return `${day} ${MONTHS[month - 1]} ${year}, ${pad(hour)}:${pad(minute)}`;
}

/** `08:00:00` or `08:00` -> `08:00`. Accepts the API's TimeSpan strings. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return value;
  return `${pad(Number(match[1]))}:${match[2]}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Reads the calendar fields out of an ISO-ish string without constructing a
 * `Date`, so a value the API already localised is not localised twice.
 */
function splitWallClock(value: string | null | undefined) {
  if (!value) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? "0"),
    minute: Number(match[5] ?? "0"),
  };
}

/** The `yyyy-MM-dd` half of a value, for a native date input. */
export function toDateInput(value: string | null | undefined): string {
  const parts = splitWallClock(value);
  if (!parts) return "";
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** The `HH:mm` half of a value, for a native time input. */
export function toTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const withDate = splitWallClock(value);
  if (withDate && /[T ]\d{2}:\d{2}/.test(value)) {
    return `${pad(withDate.hour)}:${pad(withDate.minute)}`;
  }
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  return match ? `${pad(Number(match[1]))}:${match[2]}` : "";
}

/**
 * A date input's value as a date-only wire value.
 *
 * Sent without a timezone marker: the backend stamps these as calendar dates,
 * and appending `Z` from a browser east of UTC would move the class a day.
 */
export function dateToWire(value: string): string | null {
  return value ? `${value}T00:00:00` : null;
}

/**
 * A date + time pair as the Jakarta wall-clock value the API expects.
 *
 * Deliberately *not* an instant: `JakartaTime.ToUtc` on the backend reads a
 * value with no offset as Jakarta local time, which is exactly what the admin
 * typed. Sending `new Date(...).toISOString()` instead would publish a workout
 * seven hours early.
 */
export function dateTimeToWire(
  date: string,
  time: string
): string | null {
  if (!date || !time) return null;
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return `${date}T${hhmm}`;
}

/** `08:00` -> `08:00:00`, the TimeSpan form the API binds. */
export function timeToWire(value: string): string | null {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

/** Renders a possibly-blank field for read-only display. */
export function display(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

/** Today in Jakarta, as `yyyy-MM-dd`, for date-input defaults and minimums. */
export function todayInJakarta(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/** The current Jakarta wall clock as `HH:mm`. */
export function timeNowInJakarta(): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(new Date());
}
