import { ApiError, apiPost, errorMessageOf, type RequestOptions } from "./http";
import { createClassBooking } from "./classes";
import { getMember } from "./members";

/**
 * Attendance recorded by staff instead of by a member's scan.
 *
 * Two front-desk cases, one result: a member who booked but cannot scan (flat
 * phone, unreadable QR, queue at the door), and a walk-in who never booked at
 * all. Whichever path is taken below, entitlement stays entirely backend-side —
 * a class at the member's home club spends a membership credit, a class at
 * another branch spends a drop-in visit and is refused without one.
 */
export type AttendanceResult = {
  success: boolean;
  message: string;
};

export type ManualAttendanceInput = {
  memberId: string;
  classScheduleId: string;
  /** Branch the class runs at — required by the member-scan fallback. */
  branchId?: string | null;
  /** Known member code, which saves the fallback a lookup. */
  memberCode?: string | null;
};

function normalize(
  result: Partial<AttendanceResult> | null,
  fallbackMessage: string
): AttendanceResult {
  return {
    success: result?.success === true,
    message: result?.message?.trim() || fallbackMessage,
  };
}

/**
 * Mark a member present for one class.
 *
 * Prefers `POST /api/v1/attendance/manual`, which does the whole job in one
 * call — it books a walk-in itself and does not require the coach's session to
 * be running. That endpoint is restricted to `Coach,Admin,Staff`, though, so a
 * **SuperAdmin is refused with a bodyless 403**. Rather than showing staff a
 * dead end for a permission they cannot grant themselves, this falls back to the
 * endpoints every authenticated user may call, which together do the same work:
 * book the class if needed, then record the attendance through the member-scan
 * rail. The fallback needs the session to be active, which is exactly what the
 * Activate Session button in the same screen turns on.
 *
 * Both rails answer **200 with `success: false`** when they refuse, so that flag
 * is the only truth here and the backend's own wording is passed through.
 */
export async function recordManualAttendance(
  input: ManualAttendanceInput,
  options?: RequestOptions
): Promise<AttendanceResult> {
  try {
    const result = await apiPost<Partial<AttendanceResult> | null>(
      "/api/v1/attendance/manual",
      {
        memberId: input.memberId,
        classScheduleId: input.classScheduleId,
      },
      { errorMessage: "Failed to record attendance", ...options }
    );
    return normalize(result, "Attendance recorded.");
  } catch (err) {
    // 403 is the role gate, not a bad request: retry on the open rail.
    if (!(err instanceof ApiError) || err.status !== 403) throw err;
    return recordAttendanceViaScan(input, options);
  }
}

/** Does the backend mean "this member has not booked the class"? */
function notBooked(message: string): boolean {
  return /not booked|belum\s*booking|tidak\s*booking/i.test(message);
}

/**
 * Attendance for roles the manual endpoint locks out.
 *
 * `POST /api/v1/attendance/member-scan` records the attendance and spends the
 * credit or drop-in visit exactly as the door scanner does, but it refuses a
 * member who has no booking. So a walk-in is booked first — through the same
 * `POST /api/v1/class-bookings` the member app uses — and only then scanned in.
 * The booking is attempted *after* the first refusal rather than up front, so a
 * member who already booked never gets a second one.
 */
async function recordAttendanceViaScan(
  input: ManualAttendanceInput,
  options?: RequestOptions
): Promise<AttendanceResult> {
  if (!input.branchId) {
    return {
      success: false,
      message:
        "Manual attendance was refused (403) and the class branch is unknown, so the scan path cannot be used.",
    };
  }

  let memberCode = input.memberCode?.trim() ?? "";
  if (!memberCode) {
    try {
      memberCode = (await getMember(input.memberId, options))?.memberCode?.trim() ?? "";
    } catch {
      memberCode = "";
    }
  }
  if (!memberCode) {
    return {
      success: false,
      message:
        "Manual attendance was refused (403) and the member code was not found, so the scan path cannot be used.",
    };
  }

  const scan = () =>
    apiPost<Partial<AttendanceResult> | null>(
      "/api/v1/attendance/member-scan",
      {
        memberCode,
        branchId: input.branchId,
        classScheduleId: input.classScheduleId,
      },
      { errorMessage: "Failed to record attendance", ...options }
    );

  let result = normalize(await scan(), "Attendance recorded.");
  if (result.success || !notBooked(result.message)) return result;

  // Walk-in: no booking yet, so make one and scan again.
  try {
    await createClassBooking(
      { memberId: input.memberId, classScheduleId: input.classScheduleId },
      options
    );
  } catch (err) {
    return {
      success: false,
      message: errorMessageOf(err, "Failed to book the member for this class"),
    };
  }

  result = normalize(await scan(), "Attendance recorded.");
  return result;
}
