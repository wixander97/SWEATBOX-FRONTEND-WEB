/**
 * Shared scan parser — ported verbatim from the standalone reference
 * artifacts (components/index.html and components/test-scanner.html) so the
 * admin scanner pages route scanned values exactly the same way as the
 * front-desk scanner.
 *
 * Supported formats (in priority order):
 *   1. Explicit prefix:
 *        COACH|<coachId>|<classScheduleId>
 *        MEMBER|<memberCode>
 *        PT|<ptSessionId>|<memberId>
 *   2. JSON payload:
 *        {"coachId":"…","classScheduleId":"…"}  → coach
 *        {"memberCode":"…"}                       → member
 *        {"ptSessionId":"…","memberId":"…"}      → pt (dispatched to
 *                                               /api/v1/pt-sessions/checkin
 *                                               with body {ptSessionId, memberId})
 *   3. Any other non-empty string → member code
 */

export type CoachScanIntent = {
  type: "coach";
  coachId: string;
  classScheduleId: string;
};

export type MemberScanIntent = {
  type: "member";
  memberCode: string;
  /** Branch and class schedule carried by JSON QR payloads, when present. */
  branchId?: string;
  classScheduleId?: string;
};

export type PtScanIntent = {
  type: "pt";
  ptSessionId: string;
  memberId: string;
};

export type InvalidScanIntent = {
  type: "invalid";
  reason: string;
};

export type ScanIntent =
  | CoachScanIntent
  | MemberScanIntent
  | PtScanIntent
  | InvalidScanIntent;

export function parseScan(raw: string): ScanIntent {
  const value = raw.trim();
  if (!value) return { type: "invalid", reason: "Empty scan." };

  // 1. Explicit prefix format.
  const upper = value.toUpperCase();
  if (upper.startsWith("COACH|")) {
    const parts = value.split("|");
    if (parts.length >= 3 && parts[1] && parts[2]) {
      return {
        type: "coach",
        coachId: parts[1].trim(),
        classScheduleId: parts[2].trim(),
      };
    }
    return {
      type: "invalid",
      reason: "Coach QR is malformed (expected COACH|coachId|classScheduleId).",
    };
  }
  if (upper.startsWith("MEMBER|")) {
    const code = value.slice(value.indexOf("|") + 1).trim();
    return code
      ? { type: "member", memberCode: code }
      : { type: "invalid", reason: "Member QR is malformed (expected MEMBER|code)." };
  }
  if (upper.startsWith("PT|")) {
    const parts = value.split("|");
    if (parts.length >= 3 && parts[1] && parts[2]) {
      return {
        type: "pt",
        ptSessionId: parts[1].trim(),
        memberId: parts[2].trim(),
      };
    }
    return {
      type: "invalid",
      reason: "PT QR is malformed (expected PT|ptSessionId|memberId).",
    };
  }

  // 2. JSON payload.
  if (value.charAt(0) === "{") {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { type: "invalid", reason: "QR JSON could not be parsed." };
    }
    if (obj && obj.coachId && obj.classScheduleId) {
      return {
        type: "coach",
        coachId: String(obj.coachId),
        classScheduleId: String(obj.classScheduleId),
      };
    }
    if (obj && obj.ptSessionId && obj.memberId) {
      return {
        type: "pt",
        ptSessionId: String(obj.ptSessionId).trim(),
        memberId: String(obj.memberId).trim(),
      };
    }
    if (obj && obj.memberCode) {
      const branchId = obj.branchId ? String(obj.branchId).trim() : undefined;
      const classScheduleId = obj.classScheduleId ? String(obj.classScheduleId).trim() : undefined;
      return {
        type: "member",
        memberCode: String(obj.memberCode),
        branchId: branchId || undefined,
        classScheduleId: classScheduleId || undefined,
      };
    }
    return { type: "invalid", reason: "QR JSON is missing required fields." };
  }

  // 3. Plain member code.
  return { type: "member", memberCode: value };
}
