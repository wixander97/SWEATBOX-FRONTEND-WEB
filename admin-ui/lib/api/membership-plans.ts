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
