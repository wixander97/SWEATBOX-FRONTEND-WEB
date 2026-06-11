"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pageTitleByPath } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

type Props = {
  onOpenMenu?: () => void;
};

type ProfileData = {
  roleName?: string | null;
  role?: string | null;
};

export function AdminHeader({ onOpenMenu }: Props) {
  const pathname = usePathname();
  const { displayRole, setRoleFromAuth } = useRole();
  const title = pageTitleByPath[pathname] ?? "Sweatbox Admin";

  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/v1/auth/profile`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileData | null) => {
        if (data) {
          setRoleFromAuth(data.roleName ?? data.role);
        }
      })
      .catch(() => null);
  }, [setRoleFromAuth]);

  return (
    <header className="min-h-16 bg-sidebar border-b border-border flex justify-between items-center px-4 sm:px-6 lg:px-8 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          className="lg:hidden w-9 h-9 rounded-lg bg-card border border-border text-gray-300 hover:text-white"
          aria-label="Open menu"
        >
          <i className="fas fa-bars" aria-hidden />
        </button>
        <h2 className="text-base sm:text-xl font-bold font-display uppercase tracking-wide truncate">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border border-gray-700">
          <i
            className={`fas ${displayRole === "Superadmin" ? "fa-shield-alt text-sweat" : "fa-user-shield text-gray-400"} text-xs`}
            aria-hidden
          />
          <span className="text-xs text-white font-bold">{displayRole}</span>
        </div>

        <div className="hidden sm:block w-px h-6 bg-gray-700" />

        <button
          type="button"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card border border-border flex items-center justify-center text-gray-400 hover:text-white hover:border-sweat transition relative"
          aria-label="Notifications"
        >
          <i className="fas fa-bell" aria-hidden />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button
          type="button"
          className="hidden md:inline-flex bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
        >
          <i className="fas fa-plus mr-2" aria-hidden />
          Quick Action
        </button>
      </div>
    </header>
  );
}
