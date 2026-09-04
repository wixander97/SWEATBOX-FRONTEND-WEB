import { ApiError, apiGet, apiPost, toList, type PagedResponse, type RequestOptions } from "./http";
import type { ApiClass } from "@/components/admin/classes/classes.types";
import {
  expandRecurrence,
  isRepeating,
  type RecurrenceRule,
} from "@/lib/classes/recurrence";

export type { ApiClass };

/** Body accepted by `POST/PUT /api/v1/class-schedules`. */
export type ClassSchedulePayload = {
  className: string;
  coachId: string;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  branchId: string;
  roomName: string;
  description: string;
  classType: string;
  difficultyLevel: string;
  isActive: boolean;
};

export async function listClassSchedules(options?: RequestOptions): Promise<ApiClass[]> {
  const payload = await apiGet<ApiClass[] | PagedResponse<ApiClass>>(
    "/api/v1/class-schedules",
    { errorMessage: "Gagal memuat class schedule", ...options }
  );
  return toList(payload);
}

export async function listUpcomingClassSchedules(
  options?: RequestOptions
): Promise<ApiClass[]> {
  const payload = await apiGet<ApiClass[] | PagedResponse<ApiClass>>(
    "/api/v1/class-schedules/upcoming?page=1&pageSize=200",
    { errorMessage: "Gagal memuat class schedule", ...options }
  );
  return toList(payload);
}

export function getClassSchedule(id: string, options?: RequestOptions): Promise<ApiClass> {
  return apiGet<ApiClass>(`/api/v1/class-schedules/${encodeURIComponent(id)}`, {
    errorMessage: "Gagal memuat detail class",
    ...options,
  });
}

export function createClassSchedule(
  body: ClassSchedulePayload,
  options?: RequestOptions
): Promise<ApiClass> {
  return apiPost<ApiClass>("/api/v1/class-schedules", body, {
    errorMessage: "Create class gagal",
    ...options,
  });
}

/** Convert a `YYYY-MM-DD` form value to the ISO UTC string the backend expects. */
export function toIsoClassDate(value: string): string {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export type RecurringCreateResult = {
  /** Dates that were persisted successfully. */
  created: string[];
  /** Dates that failed, with the backend message. */
  failed: Array<{ date: string; message: string }>;
  /** How the series was persisted. */
  mode: "series-endpoint" | "per-occurrence";
};

/**
 * Create every occurrence of a recurring class.
 *
 * Preferred path is a single `POST /api/v1/class-schedules/recurring` call so
 * the backend can own the series. Until that endpoint exists, the same rule is
 * expanded here and each occurrence is created through the existing
 * `POST /api/v1/class-schedules` — every occurrence is still a real, bookable
 * schedule row rather than browser-only state.
 */
export async function createRecurringClassSchedules(
  base: ClassSchedulePayload,
  rule: RecurrenceRule,
  startDate: string,
  onProgress?: (done: number, total: number) => void
): Promise<RecurringCreateResult> {
  const dates = isRepeating(rule) ? expandRecurrence(rule, startDate) : [startDate];

  try {
    await apiPost<unknown>(
      "/api/v1/class-schedules/recurring",
      {
        ...base,
        classDate: toIsoClassDate(startDate),
        recurrence: {
          frequency: rule.frequency,
          daysOfWeek: rule.daysOfWeek,
          until: toIsoClassDate(rule.until),
        },
      },
      { errorMessage: "Create recurring class gagal" }
    );
    onProgress?.(dates.length, dates.length);
    return { created: dates, failed: [], mode: "series-endpoint" };
  } catch (err) {
    if (!(err instanceof ApiError) || !err.isNotImplemented) throw err;
  }

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
        message: err instanceof Error ? err.message : "Gagal membuat jadwal",
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
    errorMessage: "Gagal membooking class",
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
    { errorMessage: "Gagal memuat booking mendatang", ...options }
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
    { errorMessage: "Gagal memuat peserta class", ...options }
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
    errorMessage: "Gagal mengaktifkan session class",
    ...options,
  });
}

/** Why a schedule cannot be activated, or `null` when it can. */
export function sessionActivationBlocker(c: ApiClass): string | null {
  if (c.isSessionActive) return "Session untuk class ini sudah aktif.";
  if (c.isCancelled) return "Class sudah dibatalkan.";
  if (c.isCompleted) return "Class sudah selesai.";
  if (c.isActive === false) return "Class non-aktif — aktifkan dulu lewat Edit.";
  if (!c.coachId) return "Class ini belum punya coach, jadi session tidak bisa diaktifkan.";
  return null;
}
