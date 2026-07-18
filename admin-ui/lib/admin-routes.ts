export const adminPaths = {
  dashboard: "/admin/dashboard",
  classes: "/admin/classes",
  members: "/admin/members",
  reports: "/admin/reports",
  workout: "/admin/workout",
  payroll: "/admin/payroll",
  payments: "/admin/payments",
  users: "/admin/users",
  membershipPlans: "/admin/membership-plans",
  history: "/admin/history",
  pt: "/admin/pt",
  scan: "/admin/scan",
  scanCamera: "/admin/scan-camera",
  systemSettings: "/admin/system-settings",
  dropIn: "/admin/drop-in",
  promoBanners: "/admin/promo-banners",
} as const;

export type AdminNavKey = keyof typeof adminPaths;

export const pageTitleByPath: Record<string, string> = {
  [adminPaths.dashboard]: "Dashboard Overview",
  [adminPaths.classes]: "Class Schedule",
  [adminPaths.members]: "Membership",
  [adminPaths.reports]: "Attendance Reports",
  // [adminPaths.workout]: "Workout Master",
  [adminPaths.payroll]: "Coaches Payroll",
  [adminPaths.payments]: "Payments",
  [adminPaths.users]: "User Management",
  [adminPaths.membershipPlans]: "Membership Plans",
  [adminPaths.history]: "History",
  [adminPaths.pt]: "Personal Training",
  [adminPaths.scan]: "Barcode Scanner",
  [adminPaths.scanCamera]: "Webcam Scanner",
  [adminPaths.systemSettings]: "System Settings",
  [adminPaths.dropIn]: "Drop In",
  [adminPaths.promoBanners]: "Promo Banners",
};
