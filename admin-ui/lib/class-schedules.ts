/**
 * Class schedules, mirroring `ClassScheduleResponse` and the create/update
 * requests.
 *
 * One row is one *occurrence* — a class on a date. The workout for that
 * occurrence lives in the workout module and is referenced from here, never
 * embedded: the same recurring class can run a different workout every day, and
 * duplicating a schedule to change its programming is exactly what the split
 * avoids.
 */

export type AssistantCoach = {
  coachId: string;
  coachName?: string | null;
  coachRateTierId?: string | null;
  rateTierName?: string | null;
  rate?: number;
};

export type ClassSchedule = {
  id: string;
  className: string;
  coachId: string;
  coachName?: string | null;
  branchId: string;
  branchName?: string | null;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  remainingSlots: number;
  roomName?: string | null;
  description?: string | null;
  classType?: string | null;
  difficultyLevel?: string | null;
  isCancelled: boolean;
  cancelReason?: string | null;
  isCompleted: boolean;
  isActive: boolean;
  isSessionActive?: boolean;

  assistantCoaches?: AssistantCoach[] | null;
  coachRateTierId?: string | null;
  coachRateTierName?: string | null;
  coachRate?: number;

  /** The workout attached to this occurrence, when one exists. */
  workoutId?: string | null;
  workoutTitle?: string | null;
  workoutStatus?: string | null;
  workoutPublished?: boolean;
};

/** One assistant picked when creating a class: the person only, no rate. */
export type AssistantCoachSelection = {
  coachId: string;
};

/** One assistant seat on an update, with its optional tier override. */
export type AssistantCoachAssignment = AssistantCoachSelection & {
  coachRateTierId: string | null;
};

export type ClassScheduleRequest = {
  className: string;
  coachId: string;
  branchId: string;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  roomName: string;
  description: string;
  classType: string;
  difficultyLevel: string;
  isActive: boolean;
  /** Create sends selections only; update carries each seat's tier. */
  assistantCoaches: Array<AssistantCoachSelection | AssistantCoachAssignment>;
  /** Update only; creating a class never names a rate. */
  coachRateTierId?: string | null;
  /** Update only; the API rejects a booked count above capacity. */
  bookedCount?: number;
  isCancelled?: boolean;
  cancelReason?: string;
  isCompleted?: boolean;
};

export const DIFFICULTY_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "All Levels",
] as const;

export const CLASS_TYPES = [
  "CrossFit",
  "HIIT",
  "Strength",
  "Conditioning",
  "Open Gym",
  "Personal Training",
  "Mobility",
] as const;

/**
 * How a class repeats.
 *
 * The API creates one occurrence per call — there is no recurrence rule on the
 * server — so a weekly pattern is expanded here into the individual dates and
 * posted one by one. That keeps every occurrence an independent row, which is
 * what lets each date carry its own workout.
 */
export type RecurrencePattern = {
  mode: "none" | "weekly";
  /** ISO weekday numbers, Monday = 1. Empty means "the start date's weekday". */
  weekdays: number[];
  /** Inclusive, `yyyy-MM-dd`. */
  repeatUntil: string;
};

export const NO_RECURRENCE: RecurrencePattern = {
  mode: "none",
  weekdays: [],
  repeatUntil: "",
};

/** Guards against a typo in the end date generating hundreds of classes. */
export const MAX_GENERATED_OCCURRENCES = 60;

/**
 * Every date a recurrence covers, starting at `startDate`.
 *
 * Dates are built by arithmetic on the calendar fields rather than through
 * `Date` in the browser's timezone, so a run that starts on the 1st cannot come
 * back beginning on the 31st for a user west of UTC.
 */
export function expandRecurrence(
  startDate: string,
  pattern: RecurrencePattern
): string[] {
  if (!startDate) return [];
  if (pattern.mode === "none") return [startDate];

  const start = parseDate(startDate);
  if (!start) return [startDate];

  const until = pattern.repeatUntil ? parseDate(pattern.repeatUntil) : null;
  if (!until || until < start) return [startDate];

  const weekdays = pattern.weekdays.length
    ? [...pattern.weekdays]
    : [isoWeekday(start)];

  const dates: string[] = [];
  const cursor = new Date(start.getTime());

  while (cursor <= until && dates.length < MAX_GENERATED_OCCURRENCES) {
    if (weekdays.includes(isoWeekday(cursor))) {
      dates.push(formatDate(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // The start date always runs, even when it falls outside the chosen
  // weekdays: the person picked that date deliberately.
  if (!dates.includes(startDate)) dates.unshift(startDate);

  return dates;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday = 1 … Sunday = 7, matching the plan access-day numbering. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}
