/**
 * Coach and assistant-coach pay tiers, as `CoachRateTierResponse` defines them.
 *
 * The two ladders share a table and are told apart by `rateType`; they are not
 * interchangeable, and the class form only ever offers a tier of the matching
 * type for each seat.
 */

export const RATE_TYPES = {
  coach: "Coach",
  assistant: "AssistantCoach",
} as const;

export type RateType = (typeof RATE_TYPES)[keyof typeof RATE_TYPES];

export const RATE_TYPE_LABEL: Record<string, string> = {
  Coach: "Coach Rate",
  AssistantCoach: "Assistant Coach Rate",
};

export type CoachRateTier = {
  id: string;
  name: string;
  rateType: string;
  rate: number;
  branchId?: string | null;
  branchName?: string | null;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type CoachRateTierRequest = {
  name: string;
  rateType: RateType;
  rate: number;
  branchId: string | null;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

/** What one seat on one class is paid, and where the number came from. */
export type ClassRateAssignment = {
  coachId: string;
  coachName: string;
  rateType: string;
  coachRateTierId?: string | null;
  rateTierName?: string | null;
  rate: number;
  /** "Assigned", "Default", "CoachPayrollRate" or "None". */
  rateSource: string;
};

export const RATE_SOURCE_LABEL: Record<string, string> = {
  Assigned: "Tier assigned on this class",
  Default: "Branch default tier",
  CoachPayrollRate: "Coach's own payroll rate",
  None: "No rate resolved",
};

/** Tiers of one type that a picker should offer, active ones first. */
export function tiersFor(
  tiers: CoachRateTier[],
  rateType: RateType,
  branchId?: string | null
): CoachRateTier[] {
  return tiers
    .filter((tier) => tier.rateType === rateType)
    .filter((tier) => tier.isActive)
    // A tier with no branch is group-wide and applies everywhere; a branch tier
    // only shows when that branch is the one selected.
    .filter((tier) => !branchId || !tier.branchId || tier.branchId === branchId)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
