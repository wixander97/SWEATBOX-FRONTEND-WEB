"use client";

import { usePathname, useRouter } from "next/navigation";
import { adminPaths, pageTitleByPath } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";
import { useTheme } from "@/lib/theme";
import type { Role } from "@/lib/rbac";

type Props = {
  /** Opens the drawer below `lg`, where the sidebar is not on screen. */
  onOpenMenu?: () => void;
};

const ROLE_OPTION_LABEL: Record<string, string> = {
  SuperAdmin: "Super Admin",
  Admin: "Admin",
  Staff: "Staff",
  Coach: "Coach",
};

export function AdminHeader({ onOpenMenu }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  // The role is resolved by RoleProvider, which is mounted on every admin page
  // including the ones that do not render this header.
  const {
    displayRole,
    effectiveRole,
    setCurrentRole,
    previewableRoles,
    isPreviewing,
    can,
  } = useRole();
  const { theme, toggleTheme } = useTheme();
  const title = pageTitleByPath[pathname] ?? "Sweatbox Admin";

  return (
    <header className="min-h-16 bg-sidebar border-b border-border flex justify-between items-center px-4 sm:px-6 lg:px-8 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/*
          * Only the drawer trigger lives here. From `lg` up the sidebar keeps
          * its own hamburger, so the control sits inside the menu it opens
          * rather than beside the page title.
          */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="lg:hidden w-9 h-9 grid place-items-center rounded-lg bg-card border border-border text-fg-soft hover:text-fg transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
          aria-label="Open menu"
          aria-controls="admin-sidebar"
        >
          <i className="fas fa-bars" aria-hidden />
        </button>
        <h2 className="text-base sm:text-xl font-bold font-display uppercase tracking-wide truncate">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        {/* A preview, not an escalation: the list only offers roles at or below
            the account's own, and permissions are narrowed accordingly. */}
        {previewableRoles.length > 1 ? (
          <div
            className={`hidden sm:flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border ${
              isPreviewing ? "border-sweat" : "border-border"
            }`}
          >
            <span className="hidden md:inline text-xs text-muted font-bold">
              <i className="fas fa-eye text-accent-ink mr-1" aria-hidden /> View As:
            </span>
            <select
              id="role-simulator"
              value={effectiveRole}
              onChange={(e) => setCurrentRole(e.target.value as Role)}
              className="bg-transparent text-fg text-xs font-bold focus:outline-none cursor-pointer appearance-none"
              aria-label="Preview the portal as a lower role"
            >
              {previewableRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_OPTION_LABEL[role] ?? role}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border border-border">
          <i
            className={`fas ${displayRole === "Superadmin" ? "fa-shield-alt text-accent-ink" : "fa-user-shield text-muted"} text-xs`}
            aria-hidden
          />
          <span className="text-xs text-fg font-bold">{displayRole}</span>
        </div>

        {can("payment.write") ? (
          <button
            type="button"
            onClick={() => router.push(adminPaths.pos)}
            className="hidden md:inline-flex items-center bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
          >
            <i className="fas fa-cash-register mr-2" aria-hidden />
            New Sale
          </button>
        ) : null}

        {/* Same control, same preference and same storage key as the POS: the
            portal and the till are never in two different themes. */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-9 h-9 grid place-items-center rounded-lg bg-card border border-border text-fg-soft hover:text-fg hover:border-sweat transition shrink-0"
        >
          <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`} aria-hidden />
        </button>
      </div>
    </header>
  );
}
