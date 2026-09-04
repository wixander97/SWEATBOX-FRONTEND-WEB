"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch, clearAuthTokenLocal } from "@/lib/auth/client-fetch";
import { useEffect, useState } from "react";
import { adminPaths } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";

type ProfileData = {
  fullName?: string | null;
  email?: string | null;
  roleName?: string | null;
  role?: string | null;
  profileImageUrl?: string | null;
};

const mainNav: { href: string; label: string; icon: string; id: string }[] = [
  { href: adminPaths.dashboard, label: "Dashboard", icon: "fa-chart-pie", id: "dashboard" },
  { href: adminPaths.pos, label: "Front Desk POS", icon: "fa-cash-register", id: "pos" },
  { href: adminPaths.classes, label: "Class Schedule", icon: "fa-calendar-alt", id: "classes" },
  { href: adminPaths.members, label: "Memberships", icon: "fa-users", id: "members" },
  { href: adminPaths.reports, label: "Attendance Reports", icon: "fa-clipboard-check", id: "reports" },
  { href: adminPaths.users, label: "User Management", icon: "fa-user-shield", id: "users" },
  { href: adminPaths.pt, label: "Personal Training", icon: "fa-id-badge", id: "pt" },
  { href: adminPaths.scan, label: "Barcode Scanner", icon: "fa-qrcode", id: "scan" },
  { href: adminPaths.scanCamera, label: "Webcam Scanner", icon: "fa-camera", id: "scan-camera" },
  { href: adminPaths.dropIn, label: "Drop In", icon: "fa-door-open", id: "drop-in" },
  { href: adminPaths.promoBanners, label: "Promo Banners", icon: "fa-bullhorn", id: "promo-banners" },
];

const dataNav: { href: string; label: string; icon: string; id: string }[] = [
  { href: adminPaths.membershipPlans, label: "Membership Plans", icon: "fa-ticket-alt", id: "membership-plans" },
  { href: adminPaths.payments, label: "Payments", icon: "fa-credit-card", id: "payments" },
  { href: adminPaths.paymentMethods, label: "Payment Method", icon: "fa-wallet", id: "payment-methods" },
  // { href: adminPaths.workout, label: "Workout Master", icon: "fa-running", id: "workout" },
  // { href: adminPaths.payroll, label: "Coaches Payroll", icon: "fa-file-invoice-dollar", id: "payroll" },
  { href: adminPaths.history, label: "History", icon: "fa-history", id: "history" },
  { href: adminPaths.systemSettings, label: "System Settings", icon: "fa-cog", id: "system-settings" },

];

/* Help is available to every role, so it is not filtered like the lists above. */
const supportNav: { href: string; label: string; icon: string; id: string }[] = [
  { href: adminPaths.help, label: "Help & Support", icon: "fa-circle-question", id: "help" },
];

/*
 * `collapsed` only ever narrows the desktop column, so every rule it adds is
 * prefixed `lg:` — below that breakpoint the same markup is the drawer, which
 * is always full width.
 */
function navButtonClasses(active: boolean, collapsed: boolean) {
  const base =
    "nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition " +
    (collapsed ? "lg:justify-center lg:gap-0 lg:px-0 " : "");
  if (active) {
    return base + "bg-sweat text-black font-bold";
  }
  return base + "hover:bg-fg/10 text-muted hover:text-fg";
}

function navLabelClasses(collapsed: boolean) {
  return "whitespace-nowrap" + (collapsed ? " lg:hidden" : "");
}

type Props = {
  /** Drawer state below `lg`. */
  open?: boolean;
  /** Narrowed to an icon rail from `lg` up, where the drawer does not apply. */
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
};

export function AdminSidebar({
  open = false,
  collapsed = false,
  onClose,
  onToggleCollapse,
}: Props) {
  const pathname = usePathname();
  const { displayName, displayRole, currentRole } = useRole();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const isSuperadmin = currentRole === "superadmin";

  // POS is a staff tool; Members must never see it.
  const filteredMainNav = mainNav.filter(
    (item) => item.id !== "pos" || currentRole !== "member"
  );

  const filteredDataNav = dataNav.filter((item) => {
    if (!isSuperadmin && (item.id === "payments" || item.id === "payment-methods")) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/v1/auth/profile`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileData | null) => { if (data) setProfile(data); })
      .catch(() => null);
  }, []);

  const name = profile?.fullName ?? displayName;
  const role = profile?.roleName ?? profile?.role ?? displayRole;
  const avatarUrl = profile?.profileImageUrl
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

  async function logout() {
    clearAuthTokenLocal();
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    window.location.replace("/login");
  }

  function renderNavItem(item: { href: string; label: string; icon: string; id: string }) {
    return (
      <Link
        key={item.href}
        href={item.href}
        id={`nav-${item.id}`}
        onClick={onClose}
        title={collapsed ? item.label : undefined}
        className={navButtonClasses(pathname === item.href, collapsed)}
      >
        <i className={`fas ${item.icon} w-5 shrink-0 text-center`} aria-hidden />
        <span className={navLabelClasses(collapsed)}>{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar overlay"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-overlay transition-opacity lg:hidden ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
      />
      {/*
        * One element serves both layouts, so the two states are expressed on
        * different breakpoints rather than by unmounting: below `lg` it slides
        * as a drawer, at `lg` and up it narrows to an icon rail.
        *
        * The rail keeps the nav — and the hamburger that toggles it — on screen
        * instead of removing the column outright, so hiding the labels never
        * leaves the page without a way back.
        */}
      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-sidebar border-r border-border flex flex-col justify-between overflow-y-auto overflow-x-hidden transform transition-[transform,width] duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "lg:w-[76px]" : "lg:w-64"}`}
      >
        <div>
          {/*
            * Same height as the page header, so the two bottom borders line up
            * across the seam. The toggle leads the row: it lands on the same
            * spot whether the column is a rail or full width, so the control
            * does not move when it is used.
            */}
          <div
            className={`h-16 flex items-center gap-3 px-4 border-b border-border ${collapsed ? "lg:justify-center lg:px-3" : ""
              }`}
          >
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden w-9 h-9 shrink-0 grid place-items-center rounded-lg text-fg-soft hover:text-fg hover:bg-fg/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
              aria-label="Close menu"
            >
              <i className="fas fa-times" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:grid w-9 h-9 shrink-0 place-items-center rounded-lg text-fg-soft hover:text-fg hover:bg-fg/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
              aria-label={collapsed ? "Show menu labels" : "Hide menu labels"}
              aria-expanded={!collapsed}
              aria-controls="admin-sidebar"
              title={collapsed ? "Show menu labels" : "Hide menu labels"}
            >
              <i className="fas fa-bars" aria-hidden />
            </button>

            <div
              className={`flex items-center gap-3 min-w-0 ${collapsed ? "lg:hidden" : ""
                }`}
            >
              <div className="w-8 h-8 shrink-0 bg-sweat rounded flex items-center justify-center font-bold text-black font-display text-lg">
                S
              </div>
              <h1 className="font-display text-xl font-bold tracking-wider text-fg whitespace-nowrap">
                SWEATBOX <span className="text-accent-ink text-xs align-top">ADMIN</span>
              </h1>
            </div>
          </div>

          <nav
            className={`mt-4 px-4 space-y-1 pb-4 ${collapsed ? "lg:px-3" : ""}`}
          >
            {filteredMainNav.map(renderNavItem)}

            <div className="pt-4 mt-2 border-t border-border">
              <p
                className={`px-4 text-[10px] text-muted font-bold uppercase tracking-wider mb-2 ${collapsed ? "lg:hidden" : ""
                  }`}
              >
                Data &amp; Finance
              </p>
              {filteredDataNav.map(renderNavItem)}
            </div>

            <div className="pt-4 mt-2 border-t border-border">
              {supportNav.map(renderNavItem)}
            </div>
          </nav>
        </div>

        <div className={`p-4 border-t border-border mt-auto ${collapsed ? "lg:p-3" : ""}`}>
          <div
            className={`flex items-center gap-3 px-4 py-2 ${collapsed ? "lg:justify-center lg:px-0" : ""
              }`}
            title={collapsed ? `${name} · ${role}` : undefined}
          >
            <Image
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="w-8 h-8 shrink-0 rounded-full"
              unoptimized
            />
            <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="text-sm font-bold text-fg truncate" id="logged-in-name">
                {name}
              </p>
              <p className="text-xs text-muted truncate" id="logged-in-role">
                {role}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Logout" : undefined}
            className="mt-3 w-full bg-fg/5 hover:bg-fg/10 text-fg py-2 rounded-lg text-sm border border-border transition"
          >
            <i className={`fas fa-sign-out-alt ${collapsed ? "lg:mr-0" : ""} mr-2`} aria-hidden />
            <span className={collapsed ? "lg:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
