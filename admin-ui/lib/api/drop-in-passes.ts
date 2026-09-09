import { apiGet, toList, type PagedResponse, type RequestOptions } from "./http";

/**
 * Member drop-in passes.
 *
 * Note the route: this controller is **not** under `/api/v1` like the rest of
 * the backend — it answers on `/api/member-drop-in-passes`. Calling the `/v1`
 * path 404s, so every caller must go through here rather than assuming the
 * usual prefix.
 *
 * A pass is issued backend-side when a drop-in payment settles; nothing in the
 * admin portal creates one directly. What this module is for is *reading* them:
 * the Drop In screen lists them, and the POS re-reads a customer's passes after
 * a drop-in sale to confirm the backend actually issued what was paid for.
 */
export type MemberDropInPass = {
  id: string;
  memberId: string;
  member: {
    fullName: string;
    memberCode: string;
    email?: string;
    phoneNumber?: string;
    membershipStatus?: string;
    remainingCredits?: number;
    /** Unlimited-class plan — `remainingCredits` is then not a quota. */
    isUnlimitedClasses?: boolean;
    remainingPtSessions?: number;
    joinDate?: string;
    expiryDate?: string;
  };
  branchId: string;
  branch: {
    branchName: string;
  };
  totalVisits: number;
  remainingVisits: number;
  purchasedAt: string;
  expiredAt: string;
  isActive: boolean;
};

/** Passes held by one member (`GET /api/member-drop-in-passes/member/{id}`). */
export async function listMemberDropInPasses(
  memberId: string,
  options?: RequestOptions
): Promise<MemberDropInPass[]> {
  const payload = await apiGet<MemberDropInPass[] | PagedResponse<MemberDropInPass>>(
    `/api/member-drop-in-passes/member/${encodeURIComponent(memberId)}`,
    { errorMessage: "Failed to load member drop-in passes", ...options }
  );
  return toList(payload);
}

/* -------------------------------------------------------------------------
   Pass status
   ------------------------------------------------------------------------- */

/**
 * What a pass is actually worth right now.
 *
 * `isActive` alone does not say it: the backend switches the flag off when the
 * last visit is spent but never when a pass simply runs out of time, so an
 * expired pass keeps reading `isActive: true` while a fully used one reads
 * `false` for a different reason entirely. Showing "Active"/"Expired" off that
 * single flag therefore mislabels both. The rule here mirrors the backend's own
 * `MemberDropInPass.IsUsable`, which is what every entitlement check consults.
 */
export type DropInPassStatus = "active" | "used-up" | "expired" | "inactive";

export function dropInPassStatus(
  pass: Pick<MemberDropInPass, "isActive" | "remainingVisits" | "expiredAt">,
  now: Date = new Date()
): DropInPassStatus {
  const expiry = new Date(pass.expiredAt);
  if (!Number.isNaN(expiry.getTime()) && expiry <= now) return "expired";
  if ((pass.remainingVisits ?? 0) <= 0) return "used-up";
  if (!pass.isActive) return "inactive";
  return "active";
}

export const DROP_IN_PASS_STATUS_META: Record<
  DropInPassStatus,
  { label: string; class: string }
> = {
  active: {
    label: "Active",
    class: "bg-green-500/10 text-success border-green-500/30",
  },
  "used-up": {
    label: "Habis",
    class: "bg-gray-500/10 text-muted border-gray-500/30",
  },
  expired: {
    label: "Expired",
    class: "bg-red-500/10 text-danger border-red-500/30",
  },
  inactive: {
    label: "Inactive",
    class: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  },
};

export function dropInPassStatusMeta(
  pass: Pick<MemberDropInPass, "isActive" | "remainingVisits" | "expiredAt">
): { label: string; class: string } {
  return DROP_IN_PASS_STATUS_META[dropInPassStatus(pass)];
}
