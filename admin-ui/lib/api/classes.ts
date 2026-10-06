import { ApiError, apiGet, apiPost, apiPut, toList, type PagedResponse, type RequestOptions } from "./http";
import type {
  AssistantCoachAssignment,
  AssistantCoachSelection,
} from "@/lib/class-schedules";
import type { ApiClass } from "@/components/admin/classes/classes.types";
import {
  expandRecurrence,
  isRepeating,
  validateFiniteRecurrence,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from "@/lib/classes/recurrence";

export type { ApiClass };

/** Body accepted by `POST/PUT /api/v1/class-schedules`. */
export type ClassSchedulePayload = {
  className: string;
  coachId: string;
  classDate: string;
  startTime: string;
  /** Still sent so older backends keep working; newer ones derive it. */
  endTime: string;
  /** When present the backend sets endTime = startTime + duration. */
  durationMinutes?: number;
  capacity: number;
  branchId: string;
  roomName: string;
  description: string;
  classType: string;
  difficultyLevel: string;
  isActive: boolean;
  /**
   * Assistant coaches on the occurrence. Create sends only who they are;
   * update may also carry each seat's rate tier.
   */
  assistantCoaches?: Array<AssistantCoachSelection | AssistantCoachAssignment>;
  /** Update only: the primary coach's rate tier; null means branch default. */
  coachRateTierId?: string | null;
};

export async function listClassSchedules(options?: RequestOptions): Promise<ApiClass[]> {
  const payload = await apiGet<ApiClass[] | PagedResponse<ApiClass>>(
    "/api/v1/class-schedules",
    { errorMessage: "Failed to load class schedules", ...options }
  );
  return toList(payload);
}

export async function listUpcomingClassSchedules(
  options?: RequestOptions
): Promise<ApiClass[]> {
  const payload = await apiGet<ApiClass[] | PagedResponse<ApiClass>>(
    "/api/v1/class-schedules/upcoming?page=1&pageSize=200",
    { errorMessage: "Failed to load class schedules", ...options }
  );
  return toList(payload);
}

export function getClassSchedule(id: string, options?: RequestOptions): Promise<ApiClass> {
  return apiGet<ApiClass>(`/api/v1/class-schedules/${encodeURIComponent(id)}`, {
    errorMessage: "Failed to load class details",
    ...options,
  });
}

export function createClassSchedule(
  body: ClassSchedulePayload,
  options?: RequestOptions
): Promise<ApiClass> {
  return apiPost<ApiClass>("/api/v1/class-schedules", body, {
    errorMessage: "Failed to create class",
    ...options,
  });
}

/** Convert a `YYYY-MM-DD` form value to the ISO UTC string the backend expects. */
export function toIsoClassDate(value: string): string {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

/** `ClassSeriesResult` returned by every series endpoint. */
export type ClassSeriesResult = {
  seriesId: string;
  created: number;
  updated: number;
  removed: number;
  keptWithBookings: number;
  generatedThrough?: string | null;
  /** Ready-to-show summary, e.g. "9 classes created through 04 Dec 2026. ..." */
  message: string;
};

/** `ClassSeriesResponse` from `GET /api/v1/class-schedules/series/{id}`. */
export type ClassSeries = {
  id: string;
  className: string;
  coachId: string;
  coachName?: string | null;
  branchId: string;
  branchName?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  roomName?: string | null;
  description?: string | null;
  classType?: string | null;
  difficultyLevel?: string | null;
  assistantCoachIds: string[];
  frequency: Exclude<RecurrenceFrequency, "none">;
  /** JS numbering, 0 = Sunday. */
  daysOfWeek: number[];
  startDate: string;
  endDate?: string | null;
  noEndDate: boolean;
  generatedThrough?: string | null;
  parentSeriesId?: string | null;
  isActive: boolean;
};

/** The rule a series repeats on, in the shape the class form edits. */
export function seriesToRecurrence(series: ClassSeries): RecurrenceRule {
  return {
    frequency: series.frequency,
    daysOfWeek: [...series.daysOfWeek].sort((a, b) => a - b),
    until: series.endDate ? series.endDate.slice(0, 10) : "",
    noEndDate: series.noEndDate || !series.endDate,
  };
}

/** The `recurrence` object accepted by the series endpoints. */
function recurrenceBody(rule: RecurrenceRule) {
  return {
    frequency: rule.frequency,
    daysOfWeek: rule.daysOfWeek,
    until: rule.noEndDate ? null : rule.until || null,
    noEndDate: rule.noEndDate,
  };
}

export function getClassSeries(seriesId: string, options?: RequestOptions): Promise<ClassSeries> {
  return apiGet<ClassSeries>(
    `/api/v1/class-schedules/series/${encodeURIComponent(seriesId)}`,
    { errorMessage: "Failed to load recurring class", ...options }
  );
}

/**
 * Edit a series from `effectiveFrom` (`YYYY-MM-DD`) on. Earlier classes are
 * untouched; the backend may answer with a new series id when it splits.
 */
export function updateClassSeries(
  seriesId: string,
  base: ClassSchedulePayload,
  rule: RecurrenceRule,
  effectiveFrom: string
): Promise<ClassSeriesResult> {
  return apiPut<ClassSeriesResult>(
    `/api/v1/class-schedules/series/${encodeURIComponent(seriesId)}`,
    {
      ...base,
      classDate: toIsoClassDate(effectiveFrom),
      effectiveFrom: toIsoClassDate(effectiveFrom),
      recurrence: recurrenceBody(rule),
    },
    { errorMessage: "Failed to update recurring class" }
  );
}

/** Stop a series after `lastDate` (`YYYY-MM-DD`, inclusive). */
export function endClassSeries(seriesId: string, lastDate: string): Promise<ClassSeriesResult> {
  return apiPost<ClassSeriesResult>(
    `/api/v1/class-schedules/series/${encodeURIComponent(seriesId)}/end`,
    { lastDate },
    { errorMessage: "Failed to end recurring class" }
  );
}

export type RecurringCreateResult = {
  /** Dates that were persisted successfully (fallback path only). */
  created: string[];
  /** Dates that failed, with the backend message. */
  failed: Array<{ date: string; message: string }>;
  /** How the series was persisted. */
  mode: "series-endpoint" | "per-occurrence";
  /** The backend's summary when the series endpoint handled it. */
  series?: ClassSeriesResult;
};

/**
 * Create a recurring class.
 *
 * Preferred path is a single `POST /api/v1/class-schedules/recurring` call: the
 * backend owns the series and generates classes a rolling window ahead, so the
 * rule may have no end date. On an older backend without that endpoint, a rule
 * with a finite end date is expanded here and each occurrence is created
 * through `POST /api/v1/class-schedules`; "No end date" cannot be emulated.
 */
export async function createRecurringClassSchedules(
  base: ClassSchedulePayload,
  rule: RecurrenceRule,
  startDate: string,
  onProgress?: (done: number, total: number) => void
): Promise<RecurringCreateResult> {
  try {
    const series = await apiPost<ClassSeriesResult>(
      "/api/v1/class-schedules/recurring",
      {
        ...base,
        classDate: toIsoClassDate(startDate),
        recurrence: recurrenceBody(rule),
      },
      { errorMessage: "Failed to create recurring class" }
    );
    return { created: [], failed: [], mode: "series-endpoint", series };
  } catch (err) {
    if (!(err instanceof ApiError) || !err.isNotImplemented) throw err;
  }

  if (rule.noEndDate) {
    throw new Error(
      "No end date needs the updated API, which this server does not have yet. Choose an end date instead."
    );
  }
  const check = validateFiniteRecurrence(rule, startDate);
  if (!check.ok) throw new Error(check.message);

  const dates = isRepeating(rule) ? expandRecurrence(rule, startDate) : [startDate];
  const created: string[] = [];
  const failed: Array<{ date: string; message: string }> = [];
  // Sequential on purpose: keeps the backend's per-class validation meaningful
  // and stops a slip in the rule from firing 180 parallel writes.
  for (const date of dates) {
    try {
      await createClassSchedule({ ...base, classDate: toIsoClassDate(date) });
      created.push(date);
    } catch (err) {
      failed.push({
        date,
        message: err instanceof Error ? err.message : "Failed to create schedule",
      });
    }
    onProgress?.(created.length + failed.length, dates.length);
  }
  return { created, failed, mode: "per-occurrence" };
}

/** `ClassBookingResponse` from `/api/v1/class-bookings/...`. */
export type ClassBooking = {
  id: string;
  memberId: string;
  memberName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  classScheduleId: string;
  className?: string | null;
  coachName?: string | null;
  classDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  bookingDate?: string | null;
  bookingStatus?: string | null;
  isCancelled?: boolean;
};

/**
 * Book a member into a class through the existing booking business logic.
 *
 * `ClassBookingService.CreateBookingAsync` enforces all of it backend-side:
 * the membership must be active, paid and unexpired, credits (minus already
 * reserved ones) must be available, and the class must be active, uncancelled
 * and not yet started. The endpoint answers with a message, not the booking.
 */
export function createClassBooking(
  body: { memberId: string; classScheduleId: string },
  options?: RequestOptions
): Promise<{ message?: string }> {
  return apiPost<{ message?: string }>("/api/v1/class-bookings", body, {
    errorMessage: "Failed to book class",
    ...options,
  });
}

/** Upcoming bookings for a member — the backend already filters by date. */
export async function listMemberUpcomingBookings(
  memberId: string,
  options?: RequestOptions
): Promise<ClassBooking[]> {
  const payload = await apiGet<ClassBooking[] | PagedResponse<ClassBooking>>(
    `/api/v1/class-bookings/member/${encodeURIComponent(memberId)}/upcoming`,
    { errorMessage: "Failed to load upcoming bookings", ...options }
  );
  return toList(payload);
}

/** Attendees of one class (`GET /api/v1/class-bookings/class/{id}`). */
export async function listBookingsForSchedule(
  classScheduleId: string,
  options?: RequestOptions
): Promise<ClassBooking[]> {
  const payload = await apiGet<ClassBooking[] | PagedResponse<ClassBooking>>(
    `/api/v1/class-bookings/class/${encodeURIComponent(classScheduleId)}`,
    { errorMessage: "Failed to load class participants", ...options }
  );
  return toList(payload);
}

export function bookedCountOf(c: ApiClass): number {
  if (c.bookedCount != null) return c.bookedCount;
  const capacity = c.capacity ?? 0;
  if (c.remainingSlots == null) return 0;
  return Math.max(0, capacity - c.remainingSlots);
}

export function remainingSlotsOf(c: ApiClass): number {
  if (c.remainingSlots != null) return c.remainingSlots;
  return Math.max(0, (c.capacity ?? 0) - bookedCountOf(c));
}

/** A class is bookable when it is active, not cancelled/completed and has room. */
export function isBookable(c: ApiClass): boolean {
  if (c.isCancelled || c.isCompleted) return false;
  if (c.isActive === false) return false;
  return remainingSlotsOf(c) > 0;
}

/**
 * Admin bypass for the coach QR scan.
 *
 * A class session is switched on backend-side by `POST /api/v1/attendance/coach-scan`
 * — the endpoint the coach's own QR normally hits — which is what flips
 * `isSessionActive` and lets member check-ins land on that schedule. When the
 * coach cannot scan (lost QR, dead tablet, coach already teaching), the front
 * desk otherwise has to key the two GUIDs into the manual Barcode Scanner page.
 *
 * This is the same call with the ids read straight off the schedule, so there
 * is no second activation path and no backend change behind it: whatever the
 * coach scan does — attendance row, payroll, session state — happens here too.
 */
export function activateClassSession(
  body: { coachId: string; classScheduleId: string },
  options?: RequestOptions
): Promise<{ message?: string }> {
  return apiPost<{ message?: string }>("/api/v1/attendance/coach-scan", body, {
    errorMessage: "Failed to activate class session",
    ...options,
  });
}

/** Why a schedule cannot be activated, or `null` when it can. */
export function sessionActivationBlocker(c: ApiClass): string | null {
  if (c.isSessionActive) return "The session for this class is already active.";
  if (c.isCancelled) return "This class has been cancelled.";
  if (c.isCompleted) return "This class has already finished.";
  if (c.isActive === false) return "This class is inactive — activate it first via Edit.";
  if (!c.coachId) return "This class has no coach assigned, so the session cannot be activated.";
  return null;
}
