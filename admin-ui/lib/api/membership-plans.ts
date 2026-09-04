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

/**
 * Drop-in products, expressed with the schema that already exists.
 *
 * The backend has no separate drop-in catalogue table: what it has is the
 * `PaymentCategory` enum (`DropInSingle` / `DropInPass`) and the
 * `MemberDropInPass` records a settled drop-in payment produces. A drop-in
 * product is therefore just a membership plan the admin marks as one, and the
 * POS sends it under the drop-in payment category instead of `Membership`.
 *
 * The marker is `planCategory` — set it to "Drop In", "Drop In Pass" or
 * "Drop In Single" on the plan. Only that field is consulted, never `planName`:
 * a plan that merely *reads* like a drop-in must not silently change which
 * payment category the customer is charged under.
 */
export type DropInKind = "single" | "pass";

/** "Drop In Pass" / "drop-in_pass" / "DROPINPASS" all normalise to "dropinpass". */
function normalizeCategory(plan: MembershipPlan): string {
  return (plan.planCategory ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

export function isDropInPlan(plan: MembershipPlan | null | undefined): boolean {
  return !!plan && normalizeCategory(plan).includes("dropin");
}

/**
 * Single visit or multi-visit pass.
 *
 * The category text decides when it says so ("Drop In Single" / "Drop In
 * Pass"); a plain "Drop In" falls back to the visit count, because one visit is
 * a single and more than one is a pass by definition.
 */
export function dropInKindOf(plan: MembershipPlan | null | undefined): DropInKind | null {
  if (!isDropInPlan(plan)) return null;
  const category = normalizeCategory(plan!);
  if (category.includes("single")) return "single";
  if (category.includes("pass")) return "pass";
  return dropInVisitsOf(plan!) > 1 ? "pass" : "single";
}

/**
 * Visits the plan is worth.
 *
 * `credits` is the plan's own quantity column and is what a drop-in pass sells
 * — 5 visits, 10 visits. A plan with none is a single visit, never zero, so a
 * mis-configured plan cannot be rung up as a pass worth nothing.
 */
export function dropInVisitsOf(plan: MembershipPlan): number {
  const credits = Number(plan.credits ?? 0);
  return Number.isFinite(credits) && credits > 0 ? Math.floor(credits) : 1;
}

/** Card/line subtitle for a drop-in plan: "10x kunjungan · 30 hari". */
export function dropInSubtitle(plan: MembershipPlan): string {
  const visits = dropInVisitsOf(plan);
  const label = visits > 1 ? `${visits}x kunjungan` : "1x kunjungan";
  return `${label} · berlaku ${plan.validityDays} hari`;
}
