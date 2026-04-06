export const adminPaths = {
  dashboard: "/admin/dashboard",
  classes: "/admin/classes",
  members: "/admin/members",
  reports: "/admin/reports",
  coaches: "/admin/coaches",
  workout: "/admin/workout",
  payroll: "/admin/payroll",
} as const;

export type AdminNavKey = keyof typeof adminPaths;

export const pageTitleByPath: Record<string, string> = {
  [adminPaths.dashboard]: "Dashboard Overview",
  [adminPaths.classes]: "Class Management",
  [adminPaths.members]: "Membership CRM",
  [adminPaths.reports]: "Attendance Reports",
  [adminPaths.coaches]: "Coach Management",
  [adminPaths.workout]: "Workout Master",
  [adminPaths.payroll]: "Coaches Payroll",
};
