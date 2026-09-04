"use client";

import type { ReactNode } from "react";

import { useRole, type UserRole } from "@/contexts/role-context";

type Props = {
  allow: UserRole[];
  children: ReactNode;
};

/**
 * Client-side role gate for admin pages.
 *
 * Route access itself is enforced by `middleware.ts` (auth) and the backend
 * (authorization); this keeps staff-only screens out of the hands of roles that
 * should not see them, e.g. Members must never reach the front-desk POS.
 */
export function RoleGuard({ allow, children }: Props) {
  const { currentRole, roleResolved } = useRole();

  if (!roleResolved) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-sweat border-t-transparent" />
        <p className="text-sm text-gray-500 mt-3">Memeriksa akses...</p>
      </div>
    );
  }

  if (!allow.includes(currentRole)) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <i className="fas fa-lock text-3xl text-gray-700 mb-3 block" aria-hidden />
        <h2 className="text-lg font-bold font-display uppercase text-white">
          Akses ditolak
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Halaman ini hanya untuk SuperAdmin, Admin, dan Staff.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
