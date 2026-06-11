"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UserRole = "superadmin" | "admin";

type RoleContextValue = {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  setRoleFromAuth: (roleName: string | null | undefined) => void;
  displayName: string;
  displayRole: string;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setRoleState] = useState<UserRole>("admin");

  const setCurrentRole = useCallback((role: UserRole) => {
    setRoleState(role);
  }, []);

  const setRoleFromAuth = useCallback((roleName: string | null | undefined) => {
    if (!roleName) {
      setRoleState("admin");
      return;
    }
    const normalized = roleName.toLowerCase().trim();
    if (normalized === "superadmin" || normalized === "super admin") {
      setRoleState("superadmin");
    } else {
      setRoleState("admin");
    }
  }, []);

  const value = useMemo<RoleContextValue>(() => {
    const isSuperadmin = currentRole === "superadmin";
    return {
      currentRole,
      setCurrentRole,
      setRoleFromAuth,
      displayName: isSuperadmin ? "Super Admin" : "Admin",
      displayRole: isSuperadmin ? "Superadmin" : "Admin",
    };
  }, [currentRole, setCurrentRole, setRoleFromAuth]);

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return ctx;
}
