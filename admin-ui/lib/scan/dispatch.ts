import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import type { ScanIntent } from "./parse-scan";

export type ScanOutcome = {
  ok: boolean;
  message: string;
  raw: unknown;
};

/**
 * Dispatch a parsed scan intent to the attendance endpoints, mirroring the
 * standalone reference scanner. Returns a normalized outcome for the UI.
 */
export async function dispatchScan(
  intent: ScanIntent,
  branchId: string,
): Promise<ScanOutcome> {
  if (intent.type === "invalid") {
    return { ok: false, message: intent.reason, raw: intent.reason };
  }

  try {
    let res: Response;

    if (intent.type === "coach") {
      res = await authFetch(`${API_BASE_URL}/api/v1/attendance/coach-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachId: intent.coachId,
          classScheduleId: intent.classScheduleId,
        }),
      });
    } else if (intent.type === "pt") {
      // PT session check-in: body {ptSessionId, memberId} sent to
      // /api/v1/pt-sessions/checkin.
      res = await authFetch(`${API_BASE_URL}/api/v1/pt-sessions/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ptSessionId: intent.ptSessionId,
          memberId: intent.memberId,
        }),
      });
    } else {
      const scanBranchId = intent.branchId || branchId;
      if (!scanBranchId) {
        return {
          ok: false,
          message: "Branch QR tidak ditemukan. Pastikan QR member menyertakan branchId.",
          raw: "No branch in QR.",
        };
      }
      const body: Record<string, unknown> = {
        memberCode: intent.memberCode,
        branchId: scanBranchId,
      };
      if (intent.classScheduleId) body.classScheduleId = intent.classScheduleId;
      res = await authFetch(`${API_BASE_URL}/api/v1/attendance/member-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (redirectToLoginIfUnauthorized(res.status)) {
      return { ok: false, message: "Session expired — redirecting to login.", raw: 401 };
    }

    const text = await res.text().catch(() => "");
    let data: unknown = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const dataObj = data as { message?: string; error?: string; title?: string } | string | null;
      const msg =
        (dataObj && typeof dataObj === "object" && (dataObj.message || dataObj.error || dataObj.title)) ||
        (typeof dataObj === "string" && dataObj) ||
        `Request failed (${res.status}).`;
      return { ok: false, message: String(msg), raw: data };
    }

    const dataObj = data as { message?: string; memberName?: string; fullName?: string; coachName?: string } | null;
    const who =
      (dataObj && (dataObj.memberName || dataObj.fullName || dataObj.coachName || dataObj.message)) ||
      (intent.type === "coach"
        ? "Coach session activated."
        : intent.type === "pt"
          ? "PT session check-in."
          : intent.memberCode);

    return { ok: true, message: String(who), raw: data };
  } catch (err) {
    return {
      ok: false,
      message: (err as Error)?.message || "Scan failed.",
      raw: String(err),
    };
  }
}

/** Manual-page dispatch: admin explicitly selects Coach, Member, or PT mode. */
export type ManualMode = "coach" | "member" | "pt";

export type ManualScanFields = {
  /** Coach mode: coachId; Member mode: memberCode; PT mode: memberId. */
  scanValue: string;
  classScheduleId?: string;
  branchId?: string;
  /** PT mode only. */
  ptSessionId?: string;
};

/**
 * Dispatch an explicit manual scan to the attendance endpoints. Used by the
 * Manual Scan page where the admin chooses the mode and fills the fields by
 * hand. Builds the exact request body per mode. Does not touch `dispatchScan`
 * (used by the camera page).
 */
export async function dispatchManualScan(
  mode: ManualMode,
  fields: ManualScanFields,
): Promise<ScanOutcome> {
  const { scanValue, classScheduleId, branchId, ptSessionId } = fields;

  if (!scanValue.trim()) {
    return { ok: false, message: "Scan value is required.", raw: "Missing scan value." };
  }
  if (mode !== "pt" && !classScheduleId?.trim()) {
    return { ok: false, message: "Class schedule ID is required.", raw: "Missing classScheduleId." };
  }
  if (mode === "member" && !branchId) {
    return { ok: false, message: "No branch is selected for this device.", raw: "No branch selected." };
  }
  if (mode === "pt" && !ptSessionId?.trim()) {
    return { ok: false, message: "PT session ID is required.", raw: "Missing ptSessionId." };
  }

  try {
    let res: Response;
    let successDefault: string;

    if (mode === "coach") {
      res = await authFetch(`${API_BASE_URL}/api/v1/attendance/coach-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachId: scanValue.trim(),
          classScheduleId: classScheduleId?.trim(),
        }),
      });
      successDefault = "Coach session activated.";
    } else if (mode === "pt") {
      res = await authFetch(`${API_BASE_URL}/api/v1/pt-sessions/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ptSessionId: ptSessionId?.trim(),
          memberId: scanValue.trim(),
        }),
      });
      successDefault = "PT session check-in.";
    } else {
      res = await authFetch(`${API_BASE_URL}/api/v1/attendance/member-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberCode: scanValue.trim(),
          branchId,
          classScheduleId: classScheduleId?.trim(),
        }),
      });
      successDefault = scanValue.trim();
    }

    if (redirectToLoginIfUnauthorized(res.status)) {
      return { ok: false, message: "Session expired — redirecting to login.", raw: 401 };
    }

    const text = await res.text().catch(() => "");
    let data: unknown = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const dataObj = data as { message?: string; error?: string; title?: string } | string | null;
      const msg =
        (dataObj && typeof dataObj === "object" && (dataObj.message || dataObj.error || dataObj.title)) ||
        (typeof dataObj === "string" && dataObj) ||
        `Request failed (${res.status}).`;
      return { ok: false, message: String(msg), raw: data };
    }

    const dataObj = data as { message?: string; memberName?: string; fullName?: string; coachName?: string } | null;
    const who =
      (dataObj && (dataObj.memberName || dataObj.fullName || dataObj.coachName || dataObj.message)) ||
      successDefault;

    return { ok: true, message: String(who), raw: data };
  } catch (err) {
    return {
      ok: false,
      message: (err as Error)?.message || "Scan failed.",
      raw: String(err),
    };
  }
}
