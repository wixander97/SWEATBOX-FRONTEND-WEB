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
    { errorMessage: "Gagal memuat drop-in pass member", ...options }
  );
  return toList(payload);
}
