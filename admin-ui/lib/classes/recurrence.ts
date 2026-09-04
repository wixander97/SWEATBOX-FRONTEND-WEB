/**
 * Recurrence rules for class schedules.
 *
 * A rule is expanded into concrete dates by `expandRecurrence`; each date
 * becomes one real `ClassSchedule` row so bookings, capacity and attendance
 * keep working exactly as they do for a single class. Nothing about recurrence
 * lives only in the browser.
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
  /** Inclusive end date, `YYYY-MM-DD`. Required for every repeating rule. */
  until: string;
};

export function emptyRecurrence(): RecurrenceRule {
  return { frequency: "none", daysOfWeek: [], until: "" };
}

export function isRepeating(rule: RecurrenceRule): boolean {
  return rule.frequency !== "none";
}

/** Hard ceiling so a mistyped end date cannot create thousands of classes. */
export const MAX_OCCURRENCES = 180;

export type RecurrenceValidation = { ok: true } | { ok: false; message: string };

export function validateRecurrence(
  rule: RecurrenceRule,
  startDate: string
): RecurrenceValidation {
  if (!isRepeating(rule)) return { ok: true };
  if (!startDate) return { ok: false, message: "Class date wajib diisi." };
  if (!rule.until) return { ok: false, message: "Repeat until date wajib diisi." };
  if (rule.until < startDate) {
    return { ok: false, message: "Repeat until harus setelah class date." };
  }
  if (
    (rule.frequency === "weekly" || rule.frequency === "biweekly") &&
    rule.daysOfWeek.length === 0
  ) {
    return { ok: false, message: "Pilih minimal satu hari untuk jadwal mingguan." };
  }
  const dates = expandRecurrence(rule, startDate);
  if (dates.length === 0) {
    return { ok: false, message: "Tidak ada tanggal yang cocok dengan pengaturan ini." };
  }
  if (dates.length > MAX_OCCURRENCES) {
    return {
      ok: false,
      message: `Terlalu banyak jadwal (${dates.length}). Maksimum ${MAX_OCCURRENCES} per seri — persempit rentang tanggalnya.`,
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
  if (!rule.until || rule.until < startDate) return [startDate];

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

/** Human summary shown in the form, e.g. "Every Mon + Wed until 31/12/2026". */
export function describeRecurrence(rule: RecurrenceRule, startDate: string): string {
  if (!isRepeating(rule)) return "Does not repeat";
  const days = WEEKDAYS.filter((d) => rule.daysOfWeek.includes(d.value))
    .map((d) => d.short)
    .join(" + ");
  const until = rule.until
    ? new Date(`${rule.until}T00:00:00`).toLocaleDateString("id-ID")
    : "?";
  const count = expandRecurrence(rule, startDate).length;
  const suffix = `until ${until} (${count} class${count === 1 ? "" : "es"})`;
  if (rule.frequency === "daily") return `Every day ${suffix}`;
  if (rule.frequency === "weekly") return `Every ${days || "week"} ${suffix}`;
  return `Every 2 weeks on ${days || "week"} ${suffix}`;
}
