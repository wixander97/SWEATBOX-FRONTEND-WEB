"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Roles mirrored from the backend: SuperAdmin, Admin, Staff, Member.
 * Anything unrecognised is treated as `admin`, matching the previous behaviour.
 */
export type UserRole = "superadmin" | "admin" | "staff" | "member";

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  staff: "Staff",
  member: "Member",
};

const ROLE_DISPLAY_NAME: Record<UserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  member: "Member",
};

type RoleContextValue = {
  currentRole: UserRole;
  /** False until the profile call has told us which role this user actually has. */
  roleResolved: boolean;
  setCurrentRole: (role: UserRole) => void;
  setRoleFromAuth: (roleName: string | null | undefined) => void;
  displayName: string;
  displayRole: string;
};

const RoleContext = createContext<RoleContextValue | null>(null);

/** Map a backend role name (any casing/spacing) onto a `UserRole`. */
export function normalizeRoleName(roleName: string | null | undefined): UserRole {
  if (!roleName) return "admin";
  const normalized = roleName.toLowerCase().replace(/[\s_-]/g, "");
  if (normalized === "superadmin") return "superadmin";
  if (normalized === "staff") return "staff";
  if (normalized === "member") return "member";
  return "admin";
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setRoleState] = useState<UserRole>("admin");
  const [roleResolved, setRoleResolved] = useState(false);

  const setCurrentRole = useCallback((role: UserRole) => {
    setRoleState(role);
    setRoleResolved(true);
  }, []);

  const setRoleFromAuth = useCallback((roleName: string | null | undefined) => {
    setRoleState(normalizeRoleName(roleName));
    setRoleResolved(true);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      currentRole,
      roleResolved,
      setCurrentRole,
      setRoleFromAuth,
      displayName: ROLE_DISPLAY_NAME[currentRole],
      displayRole: ROLE_LABEL[currentRole],
    }),
    [currentRole, roleResolved, setCurrentRole, setRoleFromAuth]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return ctx;
}
