"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SimulatedRole = "owner" | "admin";

type RoleContextValue = {
  currentRole: SimulatedRole;
  setCurrentRole: (role: SimulatedRole) => void;
  displayName: string;
  displayRole: string;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setRoleState] = useState<SimulatedRole>("owner");

  const setCurrentRole = useCallback((role: SimulatedRole) => {
    setRoleState(role);
  }, []);

  const value = useMemo<RoleContextValue>(() => {
    const isOwner = currentRole === "owner";
    return {
      currentRole,
      setCurrentRole,
      displayName: isOwner ? "Super Admin" : "Admin Staff",
      displayRole: isOwner ? "Owner / Manager" : "Operations",
    };
  }, [currentRole, setCurrentRole]);

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
