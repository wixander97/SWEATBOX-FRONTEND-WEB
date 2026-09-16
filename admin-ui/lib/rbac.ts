/**
 * What the signed-in role is allowed to do.
 *
 * This is a mirror of the `[Authorize(Roles = ...)]` attributes on the API, not
 * a second implementation of them. The backend remains the authority: every
 * table here exists only so the UI can hide a button the server would refuse
 * anyway, and a 403 that slips through is still handled where it lands.
 *
 * Keep each entry in step with the controller it names.
 */

export type Role =
  | "SuperAdmin"
  | "Admin"
  | "Staff"
  | "Coach"
  | "Member"
  | "Unknown";

export const ROLES: Role[] = [
  "SuperAdmin",
  "Admin",
  "Staff",
  "Coach",
  "Member",
];

/** Normalises the role claim, which arrives with the backend's own casing. */
export function toRole(value: string | null | undefined): Role {
  if (!value) return "Unknown";
  const match = ROLES.find(
    (role) => role.toLowerCase() === value.trim().toLowerCase()
  );
  return match ?? "Unknown";
}

export type Permission =
  /** WorkoutsController: POST/PUT/publish/schedule/unpublish/archive. */
  | "workout.write"
  /** WorkoutsController: DELETE. */
  | "workout.delete"
  /** ClassSchedulesController: POST/PUT/cancel. */
  | "class.write"
  /** ClassSchedulesController: DELETE. */
  | "class.delete"
  /** CoachRateTiersController: POST/PUT/DELETE. */
  | "coachRate.write"
  /** MembershipPlansController: POST/PUT. */
  | "membershipPlan.write"
  /** MembershipPlansController: DELETE. */
  | "membershipPlan.delete"
  /** AgreementsController: POST/PUT on documents. */
  | "agreement.write"
  /** AgreementsController: reading a member's signed copies. */
  | "agreement.readMember"
  /** MembersController: POST /members/register. */
  | "member.register"
  /** MembersController: PUT /members/{id}. */
  | "member.write"
  /** MembersController: DELETE /members/{id}. */
  | "member.delete"
  /** PaymentsController: the payment ledger (GET /payments, /paid, /pending, /failed). */
  | "payment.read"
  /** PaymentsController: creating a sale. */
  | "payment.write"
  /** SystemSettingsController: PUT/POST (any authenticated caller). */
  | "settings.write"
  /**
   * PaymentsController: GET /payments/summary, payment method admin;
   * CoachesController: GET /coaches/{id}/payroll-summary.
   */
  | "finance.read"
  /**
   * The Data & Finance area of the portal: Membership Plans, Payments &
   * Invoices, Payments, Payment Method, Coaches Payroll and History.
   */
  | "dataFinance.view";

/**
 * Roles permitted per action, copied from the controller attributes.
 *
 * Membership plans are SuperAdmin-only on both create and update — the
 * controller says so explicitly, and an Admin posting one is refused.
 */
const ALLOWED: Record<Permission, Role[]> = {
  "workout.write": ["SuperAdmin", "Admin", "Coach"],
  "workout.delete": ["SuperAdmin", "Admin"],
  "class.write": ["SuperAdmin", "Admin", "Staff"],
  "class.delete": ["SuperAdmin", "Admin"],
  "coachRate.write": ["SuperAdmin"],
  "membershipPlan.write": ["SuperAdmin"],
  "membershipPlan.delete": ["SuperAdmin"],
  "agreement.write": ["SuperAdmin"],
  "agreement.readMember": ["SuperAdmin", "Admin", "Staff"],
  "member.register": ["SuperAdmin", "Admin", "Staff"],
  "member.write": ["SuperAdmin", "Admin", "Staff"],
  "member.delete": ["SuperAdmin", "Admin"],
  // Data & Finance is not an Admin area. Staff keeps the ledger access it
  // already had for reprinting invoices at the desk.
  "payment.read": ["SuperAdmin", "Staff"],
  "payment.write": ["SuperAdmin", "Admin", "Staff"],
  "settings.write": ["SuperAdmin", "Admin"],
  "finance.read": ["SuperAdmin"],
  // Every role that could open the section before, minus Admin. Pages inside
  // still apply their own narrower permission on top of this.
  "dataFinance.view": ["SuperAdmin", "Staff", "Coach", "Member"],
};

export function roleCan(role: Role, permission: Permission): boolean {
  return ALLOWED[permission].includes(role);
}

/** The line shown in place of an action the current role cannot take. */
export const PERMISSION_DENIED_MESSAGE =
  "You do not have permission to perform this action.";

/**
 * Portal paths in the Data & Finance section, guarded by `dataFinance.view`.
 *
 * Shared by the sidebar, the page guards and `middleware.ts`, so a direct URL
 * is refused by the same rule that hides the link.
 */
export const DATA_FINANCE_PATHS = [
  "/admin/membership-plans",
  "/admin/invoices",
  "/admin/payments",
  "/admin/payment-methods",
  "/admin/payroll",
  "/admin/history",
] as const;

export function isDataFinancePath(pathname: string): boolean {
  return DATA_FINANCE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}
