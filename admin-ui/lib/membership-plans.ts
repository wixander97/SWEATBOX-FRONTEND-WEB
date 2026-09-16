/**
 * Membership plan configuration, mirroring `MembershipPlanResponseDto` and the
 * create/update request DTOs.
 *
 * The access rules configured here — which days, which hours, the last session
 * that may start — are *enforced by the backend*. What the portal does is give
 * them a place to be set and a readable summary of what was set; nothing in the
 * UI decides whether a member may enter.
 */

export type MembershipPlan = {
  id: string;
  branchId: string;
  branchName?: string | null;
  planName: string;
  description?: string | null;
  price: number;
  credits: number;
  validityDays: number;
  isUnlimitedClasses: boolean;
  isPtIncluded: boolean;
  ptSessions: number;
  isPopular: boolean;
  planCategory?: string | null;
  registrationFee: number;
  allowMultiBranchAccess: boolean;
  isActive: boolean;

  membershipType?: string | null;
  allowsClassAccess: boolean;
  allowsOpenGymAccess: boolean;
  expiresAtEndOfDay: boolean;
  /** ISO weekday numbers, Monday = 1, e.g. `"1,2,3,4,5"`. Blank means daily. */
  accessDaysOfWeek?: string | null;
  accessStartTime?: string | null;
  accessEndTime?: string | null;
  lastSessionStartTime?: string | null;

  isAvailableForSale: boolean;
  salesStartDate?: string | null;
  salesEndDate?: string | null;
  memberDiscountPercent: number;

  /** Backend-computed: whether the plan can be bought right now. */
  isOnSale: boolean;
  /**
   * Backend-computed price for a customer who already holds an active
   * membership. Equal to `price` for plan types the discount cannot touch.
   */
  memberPrice: number;
};

export type MembershipPlanRequest = {
  branchId: string;
  planName: string;
  description: string;
  price: number;
  credits: number;
  validityDays: number;
  isUnlimitedClasses: boolean;
  isPtIncluded: boolean;
  ptSessions: number;
  isPopular: boolean;
  planCategory: string;
  registrationFee: number;
  allowMultiBranchAccess: boolean;
  isActive: boolean;
  membershipType: string;
  allowsClassAccess: boolean;
  allowsOpenGymAccess: boolean;
  expiresAtEndOfDay: boolean;
  accessDaysOfWeek: string;
  accessStartTime: string | null;
  accessEndTime: string | null;
  lastSessionStartTime: string | null;
  isAvailableForSale: boolean;
  salesStartDate: string | null;
  salesEndDate: string | null;
  memberDiscountPercent: number;
};

/** The seven products, as `MembershipTypes` on the backend names them. */
export const MEMBERSHIP_TYPES = [
  { value: "Unlimited", label: "Unlimited" },
  { value: "OpenGym", label: "Open Gym" },
  { value: "DropIn", label: "Drop In" },
  { value: "DayPass", label: "1 Day Pass" },
  { value: "DropInPass", label: "Drop In Pass" },
  { value: "WeekUnlimited", label: "1 Week Unlimited" },
  { value: "Limited", label: "Limited" },
] as const;

export function membershipTypeLabel(value?: string | null): string {
  if (!value) return "Not set";
  return (
    MEMBERSHIP_TYPES.find((type) => type.value === value)?.label ?? value
  );
}

/**
 * Whether the cross-branch member discount can ever apply to this type.
 *
 * Mirrors `MembershipTypes.IsDiscountEligible`. Used only to explain the
 * discount field in the form — the amount charged is always the backend's.
 */
export function isDiscountEligibleType(value?: string | null): boolean {
  return value === "DropIn" || value === "DayPass";
}

export const WEEKDAYS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 7, short: "Sun", label: "Sunday" },
] as const;

/** `"1,2,3,4,5"` -> `[1,2,3,4,5]`. A blank value means every day. */
export function parseAccessDays(value?: string | null): number[] {
  if (!value || !value.trim()) return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);
}

export function formatAccessDays(value?: string | null): string {
  const days = parseAccessDays(value);
  if (!days.length) return "Every day";
  if (days.length === 7) return "Every day";
  // The weekday run is common enough to deserve its own wording.
  if (days.join(",") === "1,2,3,4,5") return "Monday – Friday";
  if (days.join(",") === "6,7") return "Weekends";
  return days
    .map((day) => WEEKDAYS.find((d) => d.value === day)?.short ?? day)
    .join(", ");
}

export function serializeAccessDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).join(",");
}

/** A one-line summary of the access window, for a table cell. */
export function formatAccessWindow(plan: MembershipPlan): string {
  const start = plan.accessStartTime?.slice(0, 5);
  const end = plan.accessEndTime?.slice(0, 5);
  if (!start && !end) return "All opening hours";
  if (start && end) return `${start} – ${end}`;
  return start ? `From ${start}` : `Until ${end}`;
}

/** Why a plan cannot be bought, or null when it can. */
export function unavailableReason(plan: MembershipPlan): string | null {
  if (plan.isOnSale) return null;
  if (!plan.isActive) return "Plan is inactive";
  if (!plan.isAvailableForSale) return "Not available for sale";
  if (plan.salesStartDate || plan.salesEndDate) return "Outside its sales period";
  return "Not available for sale";
}
