/**
 * Front-desk member registration.
 *
 * Mirrors `RegisterMemberRequest` on the backend, which is the contract for
 * `POST /api/v1/members/register`. Every field here is mandatory *on the
 * server*: the form marks them required for the person filling it in, but the
 * rule itself lives in `MemberRegistrationService` and holds however the
 * endpoint is reached.
 *
 * The member app's own sign-up is a different endpoint with its existing looser
 * payload and is untouched by any of this.
 */

export type RegisterMemberRequest = {
  phoneNumber: string;
  email: string;
  fullName: string;
  gender: string;
  /** Date-only, no timezone marker. */
  dateOfBirth: string | null;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  /** "How did you hear about us?", stored as the membership source. */
  membershipSource: string;
  /** Required as a declaration — "None" rather than blank. */
  injuryAllergies: string;
  waiverAccepted: boolean;
  houseRulesAccepted: boolean;
  /** `data:image/png;base64,...`, as drawn on the signature pad. */
  signatureImageData: string;
  homeClubBranchId: string | null;
};

/** The member a successful registration created, shaped for POS to select. */
export type RegisteredMember = {
  id: string;
  userId: string;
  memberCode: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  homeClubBranchId?: string | null;
  membershipStatus: string;
  /**
   * Whether the welcome email with the signed documents actually went out.
   * Registration succeeds either way, so the screen reports what happened
   * rather than claiming delivery.
   */
  welcomeEmailSent: boolean;
  welcomeEmailError?: string | null;
};

export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

export const HEAR_ABOUT_US_OPTIONS = [
  "Instagram",
  "Friend/Referral",
  "Walk-in",
  "Others",
] as const;

export const EMERGENCY_RELATION_OPTIONS = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Friend",
  "Other",
] as const;
