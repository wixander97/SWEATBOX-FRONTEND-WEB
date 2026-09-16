/**
 * Shared shapes and option lists for the customer (member) screens.
 *
 * Field names mirror the API contract exactly — `MemberResponse`,
 * `CreateMemberRequest`/`UpdateMemberRequest` and `RegisterRequestMember` on
 * the backend — so a payload can be handed to `fetch` without a translation
 * layer in between.
 */

/** A member as the API returns it. */
export type ApiMember = {
  id: string;
  memberCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;

  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  /** Null for members registered before the field was collected. */
  emergencyContactRelation?: string | null;
  /** Null when the member declared nothing at sign-up. */
  injuryAllergies?: string | null;

  /** How the member heard about the gym. */
  membershipSource?: string | null;

  membershipPlanId?: string | null;
  membershipPlanName?: string | null;
  membershipStatus?: string | null;
  paymentStatus?: string | null;
  remainingCredits?: number;
  remainingPtSessions?: number;
  expiryDate?: string | null;
  freezeStartDate?: string | null;
  freezeEndDate?: string | null;
  homeClubBranchId?: string | null;
  homeClubBranchName?: string | null;
  address?: string | null;
  city?: string | null;
  heightCm?: number;
  weightKg?: number;
  profileImageUrl?: string | null;
  notes?: string | null;
  isWaiverSigned?: boolean;
  isPtMember?: boolean;
  isActive?: boolean;

  /** Legacy list columns, kept so existing table rendering is unchanged. */
  membershipType?: string | null;
  homeClub?: string | null;
};

/** The fields the add/edit customer form collects. */
export type CustomerFormValues = {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  email: string;
  password: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  injuryAllergies: string;
  howDidYouHearAboutUs: string;
};

export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

/**
 * The exact four answers the sign-up form offers. Stored in the
 * `membershipSource` column, which already holds free text of this shape, so
 * older rows with values outside this list still display fine.
 */
export const HEAR_ABOUT_US_OPTIONS = [
  "Instagram",
  "Friend/Referral",
  "Walk-in",
  "Others",
] as const;

/** `2024-05-01T00:00:00Z` -> `2024-05-01`, for a native date input. */
export function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/**
 * A date input's value as the API wants it. Empty stays `null` rather than
 * becoming an epoch date, so "not answered" survives a round trip.
 */
export function toApiDate(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00Z`).toISOString();
}

/**
 * Trims a form value, mapping blank to `null`.
 *
 * The new columns are nullable and optional on the backend, so sending `null`
 * for an untouched field keeps it indistinguishable from a member who was
 * never asked.
 */
export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Renders a possibly-null field for read-only display. */
export function display(value?: string | null): string {
  return value && value.trim() ? value : "-";
}
