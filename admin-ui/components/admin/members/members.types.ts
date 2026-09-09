export type ApiMember = {
  id: string;
  /** Login account this member belongs to. Null for unlinked legacy records. */
  userId?: string | null;
  memberCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  injuryAllergies?: string | null;
  membershipPlanId?: string | null;
  membershipPlanName?: string | null;
  membershipStatus?: string | null;
  paymentStatus?: string | null;
  remainingCredits?: number;
  /**
   * The member is on a plan that grants unlimited classes, so `remainingCredits`
   * is not a quota and must not be shown as one. Strictly the backend's flag —
   * never inferred from `remainingCredits === 0`.
   */
  isUnlimitedClasses?: boolean;
  remainingPtSessions?: number;
  remainingDropInVisits?: number;
  joinDate?: string | null;
  expiryDate?: string | null;
  freezeStartDate?: string | null;
  freezeEndDate?: string | null;
  homeClubBranchId?: string | null;
  homeClubBranchName?: string | null;
  membershipSource?: string | null;
  address?: string | null;
  city?: string | null;
  heightCm?: number;
  weightKg?: number;
  profileImageUrl?: string | null;
  notes?: string | null;
  isWaiverSigned?: boolean;
  isPtMember?: boolean;
  isExpired?: boolean;
  isActive?: boolean;
};

/**
 * "How did you hear about us?" — stored in the existing `membershipSource`
 * field. Static by design: there is no master-data endpoint for these, so the
 * list lives in the front end until there is one.
 */
export const MEMBERSHIP_SOURCE_OPTIONS = [
  "Instagram",
  "Friend/Referral",
  "Walk-in",
  "Others",
] as const;

/** Shown in place of a credit count for a member on an unlimited-class plan. */
export const UNLIMITED_CLASSES_LABEL = "Unlimited";

/** Anything carrying the backend's class-entitlement pair. */
export type ClassCreditsSource = {
  remainingCredits?: number | null;
  isUnlimitedClasses?: boolean | null;
};

/**
 * Whether class bookings are unlimited for this member.
 *
 * The only source of truth is the backend's `isUnlimitedClasses`; a zero credit
 * balance says nothing about it.
 */
export function hasUnlimitedClasses(
  source: ClassCreditsSource | null | undefined
): boolean {
  return source?.isUnlimitedClasses === true;
}

/**
 * Class entitlement as one display string: "Unlimited" for an unlimited plan,
 * the existing credit count otherwise.
 */
export function formatClassCredits(
  source: ClassCreditsSource | null | undefined,
  fallback = "-"
): string {
  if (hasUnlimitedClasses(source)) return UNLIMITED_CLASSES_LABEL;
  const credits = source?.remainingCredits;
  return credits === null || credits === undefined ? fallback : String(credits);
}

export type Branch = {
  id: string;
  branchName: string;
  isActive: boolean;
};

export type MembershipPlan = {
  id: string;
  planName: string;
  description?: string | null;
  price?: number;
  credits: number;
  validityDays: number;
  isActive: boolean;
  /** Plans marked unlimited grant classes without spending credits. */
  isUnlimitedClasses?: boolean;
};

export type MemberFormState = {
  // Basic Info
  fullName: string;
  phoneNumber: string;
  // Personal
  gender: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  injuryAllergies: string;
  address: string;
  city: string;
  // Emergency
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  // Membership
  membershipSource: string;
  remainingCredits: string;
  /** Display-only: mirrors the member's / selected plan's unlimited flag. */
  isUnlimitedClasses: boolean;
  remainingPtSessions: string;
  expiryDate: string;
  homeClubBranchId: string;
  membershipPlanId: string;
  membershipStatus: string;
  paymentStatus: string;
  // Freeze
  freezeStartDate: string;
  freezeEndDate: string;
  // Account Status
  profileImageUrl: string;
  notes: string;
  isWaiverSigned: boolean;
  isPtMember: boolean;
  isActive: boolean;
};

export type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  page?: number;
  pageNumber?: number;
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  message?: string;
};

export function emptyMemberForm(): MemberFormState {
  return {
    fullName: "",
    phoneNumber: "",
    // Personal
    gender: "",
    dateOfBirth: "",
    heightCm: "",
    weightKg: "",
    injuryAllergies: "",
    address: "",
    city: "",
    // Emergency
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    // Membership
    membershipSource: "",
    remainingCredits: "0",
    isUnlimitedClasses: false,
    remainingPtSessions: "0",
    expiryDate: "",
    homeClubBranchId: "",
    membershipPlanId: "",
    membershipStatus: "",
    paymentStatus: "",
    // Freeze
    freezeStartDate: "",
    freezeEndDate: "",
    // Account Status
    profileImageUrl: "",
    notes: "",
    isWaiverSigned: false,
    isPtMember: false,
    isActive: true,
  };
}

export function parseDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  // Ensure UTC parsing for datetime strings without explicit timezone
  const hasTime = /T\d{2}:\d{2}/.test(isoString);
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(isoString);
  const normalized = hasTime && !hasTz ? isoString + "Z" : isoString;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Convert an ISO datetime string into the `YYYY-MM-DDTHH:mm` value a datetime-local input expects (UTC). */
export function parseDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const hasTime = /T\d{2}:\d{2}/.test(isoString);
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(isoString);
  const normalized = hasTime && !hasTz ? isoString + "Z" : isoString;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  // datetime-local value format: YYYY-MM-DDTHH:mm (no seconds, no timezone suffix)
  return d.toISOString().slice(0, 16);
}

export function memberToForm(m: ApiMember): MemberFormState {
  return {
    fullName: m.fullName ?? "",
    phoneNumber: m.phoneNumber ?? "",
    // Personal
    gender: m.gender ?? "",
    dateOfBirth: parseDate(m.dateOfBirth),
    heightCm: String(m.heightCm ?? ""),
    weightKg: String(m.weightKg ?? ""),
    injuryAllergies: m.injuryAllergies ?? "",
    address: m.address ?? "",
    city: m.city ?? "",
    // Emergency
    emergencyContactName: m.emergencyContactName ?? "",
    emergencyContactPhone: m.emergencyContactPhone ?? "",
    emergencyContactRelation: m.emergencyContactRelation ?? "",
    // Membership
    membershipSource: m.membershipSource ?? "",
    remainingCredits: String(m.remainingCredits ?? 0),
    isUnlimitedClasses: m.isUnlimitedClasses === true,
    remainingPtSessions: String(m.remainingPtSessions ?? 0),
    expiryDate: parseDate(m.expiryDate),
    homeClubBranchId: m.homeClubBranchId ?? "",
    membershipPlanId: m.membershipPlanId ?? "",
    membershipStatus: m.membershipStatus ?? "",
    paymentStatus: m.paymentStatus ?? "",
    // Freeze
    freezeStartDate: parseDateTime(m.freezeStartDate),
    freezeEndDate: parseDateTime(m.freezeEndDate),
    // Account Status
    profileImageUrl: m.profileImageUrl ?? "",
    notes: m.notes ?? "",
    isWaiverSigned: m.isWaiverSigned ?? false,
    isPtMember: m.isPtMember ?? false,
    isActive: m.isActive ?? true,
  };
}

export function statusStyle(status: string) {
  let s = "bg-gray-500/10 text-gray-500";
  if (status === "Active") {
    s = "bg-green-500/10 text-green-500 border border-green-500/20";
  }
  if (status === "Expiring Soon") {
    s =
      "bg-yellow-500/10 text-yellow-500 border border-yellow-500/50 animate-pulse";
  }
  if (status === "Expired") {
    s = "bg-red-500/10 text-red-500";
  }
  return s;
}

export function dateToIso(dateStr: string): string | null {
  if (!dateStr) return null;
  // If it's YYYY-MM-DD from date input, convert to full ISO format with time
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + "T00:00:00.000Z");
    return d.toISOString();
  }
  // If it's already ISO string, return as is
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parseIntSafe(val: string): number {
  const n = Number.parseInt(val, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Convert a datetime-local value (`YYYY-MM-DDTHH:mm`) into an ISO string, or `null` when empty/invalid. */
export function dateTimeToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value + ":00.000Z");
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function calculateExpiryDate(validityDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + validityDays);
  return date.toISOString().slice(0, 10);
}
