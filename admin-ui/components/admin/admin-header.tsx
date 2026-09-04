"use client";

import { usePathname } from "next/navigation";
import { pageTitleByPath } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";
import { useTheme } from "@/lib/theme";

type Props = {
  onOpenMenu?: () => void;
};

export function AdminHeader({ onOpenMenu }: Props) {
  const pathname = usePathname();
  // The role is resolved by RoleProvider, which is mounted on every admin page
  // including the ones that do not render this header.
  const { displayRole } = useRole();
  const { theme, toggleTheme } = useTheme();
  const title = pageTitleByPath[pathname] ?? "Sweatbox Admin";

  return (
    <header className="min-h-16 bg-sidebar border-b border-border flex justify-between items-center px-4 sm:px-6 lg:px-8 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          className="lg:hidden w-9 h-9 rounded-lg bg-card border border-border text-fg-soft hover:text-fg"
          aria-label="Open menu"
        >
          <i className="fas fa-bars" aria-hidden />
        </button>
        <h2 className="text-base sm:text-xl font-bold font-display uppercase tracking-wide truncate">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border border-border">
          <i
            className={`fas ${displayRole === "Superadmin" ? "fa-shield-alt text-accent-ink" : "fa-user-shield text-muted"} text-xs`}
            aria-hidden
          />
          <span className="text-xs text-fg font-bold">{displayRole}</span>
        </div>

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
