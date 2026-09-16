"use client";

import type { ReactNode } from "react";

import { useRole, type UserRole } from "@/contexts/role-context";
import type { Permission } from "@/lib/rbac";

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

  if (!roleResolved) return <CheckingAccess />;

  if (!allow.includes(currentRole)) {
    return (
      <AccessDenied message="This page is only available to SuperAdmin, Admin, and Staff." />
    );
  }

  return <>{children}</>;
}

/**
 * Permission gate for a whole page, keyed on the same table as `can()`.
 *
 * Used where a role must not reach a page even by typing its URL — the Data &
 * Finance section for Admin. The API refuses the calls regardless; this keeps
 * the page from rendering a shell of failed requests.
 */
export function PermissionGuard({
  permission,
  message = "Your role does not have access to this page.",
  children,
}: {
  permission: Permission;
  message?: string;
  children: ReactNode;
}) {
  const { can, roleResolved } = useRole();

  if (!roleResolved) return <CheckingAccess />;

  if (!can(permission)) return <AccessDenied message={message} />;

  return <>{children}</>;
}

function CheckingAccess() {
  return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-sweat border-t-transparent" />
      <p className="text-sm text-muted mt-3">Checking access...</p>
    </div>
  );
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <i className="fas fa-lock text-3xl text-muted mb-3 block" aria-hidden />
      <h2 className="text-lg font-bold font-display uppercase text-fg">
        Access Denied
      </h2>
      <p className="text-sm text-muted mt-1">{message}</p>
    </div>
  );
}
