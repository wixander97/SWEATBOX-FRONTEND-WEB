import { apiGet, toList, type PagedResponse, type RequestOptions } from "./http";

/** Membership plan as returned by `GET /api/v1/membership-plans`. */
export type MembershipPlan = {
  id: string;
  planName: string;
  description?: string | null;
  price?: number;
  credits: number;
  validityDays: number;
  isActive: boolean;
  branchId?: string;
  branchName?: string;
  isUnlimitedClasses?: boolean;
  isPtIncluded?: boolean;
  ptSessions?: number;
  isPopular?: boolean;
  planCategory?: string | null;
  registrationFee?: number;
  allowMultiBranchAccess?: boolean;
};

export async function listMembershipPlans(options?: RequestOptions): Promise<MembershipPlan[]> {
  const payload = await apiGet<MembershipPlan[] | PagedResponse<MembershipPlan>>(
    "/api/v1/membership-plans?page=1&pageSize=200",
    { errorMessage: "Gagal memuat membership plan", ...options }
  );
  return toList(payload).filter((p) => p.isActive !== false);
}

/**
 * One plan by id.
 *
 * The member record carries only `membershipPlanId`, but the front desk has to
 * show *which kind* of membership it is — unlimited, regular gym access, or
 * credit-based — because that decides what the member can actually do at the
 * counter. Those flags live on the plan, so the POS resolves it.
 */
export function getMembershipPlan(
  id: string,
  options?: RequestOptions
): Promise<MembershipPlan> {
  return apiGet<MembershipPlan>(
    `/api/v1/membership-plans/${encodeURIComponent(id)}`,
    { errorMessage: "Gagal memuat membership plan", ...options }
  );
}

/** How a plan grants class access — the three shapes the backend distinguishes. */
export type MembershipKind = "unlimited" | "regular" | "credit";

export function membershipKindOf(plan: MembershipPlan | null): MembershipKind | null {
  if (!plan) return null;
  if ((plan.planCategory ?? "").toLowerCase() === "regular") return "regular";
  if (plan.isUnlimitedClasses) return "unlimited";
  return "credit";
}
