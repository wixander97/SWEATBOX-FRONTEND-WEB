/**
 * Recurrence rules for class schedules.
 *
 * The backend owns a series (`POST /api/v1/class-schedules/recurring`): it
 * generates real `ClassSchedule` rows a rolling window ahead, so a rule may
 * have no end date at all. `expandRecurrence` remains only for the fallback on
 * older backends, where each date is created one by one and therefore needs a
 * finite end date and the `MAX_OCCURRENCES` cap.
 */

export type RecurrenceFrequency = "none" | "daily" | "weekly" | "biweekly";

/** ISO weekday numbers as produced by `Date.getDay()` (0 = Sunday). */
export const WEEKDAYS: ReadonlyArray<{ value: number; label: string; short: string }> = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  /** Weekday numbers (0-6). Used by `weekly` and `biweekly`. */
  daysOfWeek: number[];
  /** Inclusive end date, `YYYY-MM-DD`. Ignored when `noEndDate` is set. */
  until?: string;
  /** Repeat until the series is ended; the backend keeps generating ahead. */
  noEndDate: boolean;
};

export function emptyRecurrence(): RecurrenceRule {
  return { frequency: "none", daysOfWeek: [], until: "", noEndDate: true };
}

/** Weekday (0 = Sunday) of a `YYYY-MM-DD` date, or null when it is blank. */
export function weekdayOf(date: string): number | null {
  const parsed = parseDateOnly(date);
  return parsed ? parsed.getDay() : null;
}

/** A weekly rule on the given date's weekday that never ends. */
export function weeklyOn(date: string): RecurrenceRule {
  const day = weekdayOf(date);
  return {
    frequency: "weekly",
    daysOfWeek: day == null ? [] : [day],
    until: "",
    noEndDate: true,
  };
}

export function isRepeating(rule: RecurrenceRule): boolean {
  return rule.frequency !== "none";
}

/** Hard ceiling so a mistyped end date cannot create thousands of classes. */
export const MAX_OCCURRENCES = 180;

export type RecurrenceValidation = { ok: true } | { ok: false; message: string };

/**
 * What the series endpoint needs: a weekday for weekly rules and, when the
 * rule ends on a date, an end date on or after the begin date. There is no
 * occurrence cap — the backend generates a rolling window.
 */
export function validateRecurrence(
  rule: RecurrenceRule,
  startDate: string
): RecurrenceValidation {
  if (!isRepeating(rule)) return { ok: true };
  if (!startDate) return { ok: false, message: "Begin date is required." };
  if (
    (rule.frequency === "weekly" || rule.frequency === "biweekly") &&
    rule.daysOfWeek.length === 0
  ) {
    return { ok: false, message: "Select at least one day to repeat on." };
  }
  if (!rule.noEndDate) {
    if (!rule.until) return { ok: false, message: "End date is required." };
    if (rule.until < startDate) {
      return { ok: false, message: "End date must be on or after the begin date." };
    }
  }
  return { ok: true };
}

/**
 * Extra check for the per-occurrence fallback, which creates every date from
 * the browser: it needs a finite end date and stays under `MAX_OCCURRENCES`.
 */
export function validateFiniteRecurrence(
  rule: RecurrenceRule,
  startDate: string
): RecurrenceValidation {
  if (!isRepeating(rule)) return { ok: true };
  if (rule.noEndDate || !rule.until) {
    return { ok: false, message: "End date is required." };
  }
  const dates = expandRecurrence(rule, startDate);
  if (dates.length === 0) {
    return { ok: false, message: "No dates match these settings." };
  }
  if (dates.length > MAX_OCCURRENCES) {
    return {
      ok: false,
      message: `Too many schedules (${dates.length}). Maximum ${MAX_OCCURRENCES} per series — narrow the date range.`,
    };
  }
  return { ok: true };
}

/**
 * Expand a rule into `YYYY-MM-DD` dates, always including `startDate` itself.
 * Dates are unique and sorted; the list is capped at `MAX_OCCURRENCES + 1` so
 * validation can report an over-long series without looping forever.
 */
export function expandRecurrence(rule: RecurrenceRule, startDate: string): string[] {
  if (!startDate) return [];
  if (!isRepeating(rule)) return [startDate];
  if (rule.noEndDate || !rule.until || rule.until < startDate) return [startDate];

  const start = parseDateOnly(startDate);
  const until = parseDateOnly(rule.until);
  if (!start || !until) return [startDate];

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= until.getTime() && dates.length <= MAX_OCCURRENCES) {
    if (matchesRule(rule, cursor, start)) {
      dates.push(formatDateOnly(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // The first class always happens on the chosen date, even when that weekday
  // is not ticked (staff picked it explicitly).
  if (!dates.includes(startDate)) dates.unshift(startDate);
  return dates;
}

function matchesRule(rule: RecurrenceRule, day: Date, start: Date): boolean {
  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekly":
      return rule.daysOfWeek.includes(day.getDay());
    case "biweekly":
      return rule.daysOfWeek.includes(day.getDay()) && weeksBetween(start, day) % 2 === 0;
    default:
      return false;
  }
}

/** Whole weeks between two dates, counting from the Sunday of each week. */
function weeksBetween(from: Date, to: Date): number {
  const fromWeekStart = new Date(from);
  fromWeekStart.setDate(fromWeekStart.getDate() - fromWeekStart.getDay());
  const toWeekStart = new Date(to);
  toWeekStart.setDate(toWeekStart.getDate() - toWeekStart.getDay());
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((toWeekStart.getTime() - fromWeekStart.getTime()) / msPerWeek);
}

export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Human summary shown in the form, e.g. "Every Mon + Wed, no end date" or
 * "Every Mon + Wed until 31/12/2026 (18 classes)".
 */
export function describeRecurrence(rule: RecurrenceRule, startDate: string): string {
  if (!isRepeating(rule)) return "Does not repeat";
  const days = WEEKDAYS.filter((d) => rule.daysOfWeek.includes(d.value))
    .map((d) => d.short)
    .join(" + ");
  let suffix: string;
  if (rule.noEndDate) {
    suffix = ", no end date";
  } else if (rule.until) {
    const count = expandRecurrence(rule, startDate).length;
    suffix = ` until ${new Date(`${rule.until}T00:00:00`).toLocaleDateString("en-GB")} (${count} class${count === 1 ? "" : "es"})`;
  } else {
    suffix = " until ?";
  }
  if (rule.frequency === "daily") return `Every day${suffix}`;
  if (rule.frequency === "weekly") return `Every ${days || "week"}${suffix}`;
  return `Every 2 weeks on ${days || "week"}${suffix}`;
}
