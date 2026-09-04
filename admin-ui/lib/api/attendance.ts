import { apiPost, type RequestOptions } from "./http";

/**
 * Attendance recorded by staff instead of by a scan.
 *
 * `POST /api/v1/attendance/manual` is the endpoint the backend already exposes
 * to Coach/Admin/Staff, and it does considerably more than write an attendance
 * row — which is what makes both front-desk cases one call:
 *
 *  - **Bypass the member's QR.** A member who booked but cannot scan (phone
 *    flat, QR unreadable, queue at the door) is marked present by staff. Unlike
 *    the member scan, this does not need the coach's session to be active.
 *
 *  - **Walk-in.** A member who never booked is *booked by the backend on the
 *    spot* and then marked present, capacity permitting.
 *
 * Either way the backend enforces the same entitlement it always does: a class
 * at the member's home club spends a membership credit, a class at another
 * branch spends a drop-in visit and is refused without one. Nothing here
 * decides any of that.
 */
export type AttendanceResult = {
  success: boolean;
  message: string;
};

/**
 * Mark a member present for one class.
 *
 * The endpoint answers **200 with `success: false`** when it refuses — an
 * expired membership, no credits, no drop-in pass for that branch, a full or
 * completed class — so the flag is the only truth here and the message is the
 * backend's own words, shown to staff unchanged.
 */
export async function recordManualAttendance(
  body: { memberId: string; classScheduleId: string },
  options?: RequestOptions
): Promise<AttendanceResult> {
  const result = await apiPost<Partial<AttendanceResult> | null>(
    "/api/v1/attendance/manual",
    body,
    { errorMessage: "Gagal mencatat absensi", ...options }
  );

  return {
    success: result?.success === true,
    message:
      result?.message?.trim() ||
      (result?.success === true ? "Absensi tercatat." : "Absensi ditolak backend."),
  };
}
