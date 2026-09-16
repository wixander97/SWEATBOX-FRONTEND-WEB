"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import {
  roleCan,
  toRole,
  type Permission,
  type Role,
} from "@/lib/rbac";

/**
 * The signed-in account, and what it is allowed to do.
 *
 * The role comes from the API's own profile endpoint rather than from anything
 * the browser chose, so the buttons a screen offers match the ones the backend
 * will accept. The "view as" control is kept, but it can only *narrow* the
 * effective role: previewing the desk's view must never hand the previewer
 * permissions their account does not have, and pretending otherwise would show
 * actions the server refuses.
 *
 * Two role vocabularies are published on purpose, both derived from the one
 * resolved role:
 *
 *  - `currentRole` is the lowercase {@link UserRole} the page chrome and
 *    `RoleGuard` have always switched on.
 *  - `actualRole`/`effectiveRole` are the backend's own casing ({@link Role}),
 *    which is what {@link roleCan} and therefore `can()` are keyed on.
 */

/**
 * Roles mirrored from the backend: SuperAdmin, Admin, Staff, Coach, Member.
 * Anything unrecognised is treated as `admin`, matching the previous behaviour.
 */
export type UserRole = "superadmin" | "admin" | "staff" | "coach" | "member";

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  staff: "Staff",
  coach: "Coach",
  member: "Member",
};

const ROLE_DISPLAY_NAME: Record<UserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  coach: "Coach",
  member: "Member",
};

export type SessionProfile = {
  email: string | null;
  fullName: string | null;
  role: Role;
};

type RoleContextValue = {
  /** The account's real role, in the backend's casing. */
  actualRole: Role;
  /** The role the screens are rendered for — the real one, or a narrower preview. */
  effectiveRole: Role;
  /** The effective role in the lowercase vocabulary the chrome switches on. */
  currentRole: UserRole;
  /** False until the profile call has told us which role this user actually has. */
  roleResolved: boolean;
  setCurrentRole: (role: Role | UserRole) => void;
  setRoleFromAuth: (roleName: string | null | undefined) => void;
  /** Whether a narrower role is being previewed. */
  isPreviewing: boolean;
  /** Roles this account may preview: its own, plus anything below it. */
  previewableRoles: Role[];
  can: (permission: Permission) => boolean;
  displayName: string;
  displayRole: string;
  email: string | null;
  loading: boolean;
};

const RoleContext = createContext<RoleContextValue | null>(null);

/** Most privileged first; a role may preview itself and anything after it. */
const HIERARCHY: Role[] = ["SuperAdmin", "Admin", "Staff", "Coach"];

function previewable(role: Role): Role[] {
  const index = HIERARCHY.indexOf(role);
  if (index < 0) return [role];
  return HIERARCHY.slice(index);
}

/** Map a backend role name (any casing/spacing) onto a `UserRole`. */
export function normalizeRoleName(roleName: string | null | undefined): UserRole {
  if (!roleName) return "admin";
  const normalized = roleName.toLowerCase().replace(/[\s_-]/g, "");
  if (normalized === "superadmin") return "superadmin";
  if (normalized === "staff") return "staff";
  if (normalized === "coach") return "coach";
  if (normalized === "member") return "member";
  return "admin";
}

/**
 * The lowercase view of a canonical role.
 *
 * `Unknown` keeps the long-standing `admin` fallback so a profile call that
 * fails does not lock a signed-in user out of the chrome. It does not widen
 * `can()`: that stays keyed on the canonical role, which remains `Unknown` and
 * therefore grants nothing.
 */
export function toUserRole(role: Role): UserRole {
  return normalizeRoleName(role === "Unknown" ? null : role);
}

type ProfileResponse = {
  user?: string | null;
  User?: string | null;
  email?: string | null;
  Email?: string | null;
  role?: string | null;
  Role?: string | null;
  roleName?: string | null;
  fullName?: string | null;
};

function readProfile(data: ProfileResponse | null): SessionProfile {
  return {
    email: data?.email ?? data?.Email ?? null,
    fullName: data?.fullName ?? data?.user ?? data?.User ?? null,
    role: toRole(data?.roleName ?? data?.role ?? data?.Role),
  };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  const pathname = usePathname();
  const requestedRef = useRef(false);

  const setRoleFromAuth = useCallback((roleName: string | null | undefined) => {
    setProfile((prev) => ({
      email: prev?.email ?? null,
      fullName: prev?.fullName ?? null,
      role: toRole(roleName),
    }));
    setRoleResolved(true);
    setLoading(false);
  }, []);

  /*
   * Resolve the signed-in role here rather than in a chrome component.
   *
   * `RoleGuard` blocks rendering until the role is known, so whoever resolves it
   * must always be mounted on a guarded page. Hanging that off `AdminHeader`
   * meant any admin screen without the header — the full-screen POS — sat on
   * "Checking access..." forever. The provider is always mounted, so it owns it.
   *
   * Restricted to /admin so the login page does not fire a profile call it can
   * only get a 401 from.
   *
   * The same-origin session route is tried first, which keeps the token in the
   * httpOnly cookie. Deployments that signed in before that route existed still
   * hold only the localStorage bearer token, so a failure falls back to calling
   * the API directly with it rather than leaving the user role-less.
   */
  useEffect(() => {
    if (requestedRef.current) return;
    if (!pathname?.startsWith("/admin")) return;
    requestedRef.current = true;

    let cancelled = false;

    async function load() {
      let data: ProfileResponse | null = null;
      try {
        data = await apiRequest<ProfileResponse>("/api/auth/session", {
          allowUnauthenticated: true,
        });
      } catch {
        try {
          const res = await authFetch(`${API_BASE_URL}/api/v1/auth/profile`, {
            cache: "no-store",
          });
          data = res.ok ? ((await res.json()) as ProfileResponse) : null;
        } catch {
          // A failed probe leaves the canonical role unknown, which grants
          // nothing. The middleware already redirects an unauthenticated
          // visitor away from /admin, so there is nothing further to do here.
          data = null;
        }
      }

      if (cancelled) return;
      // Always resolve: role-gated screens wait on this before rendering.
      setProfile(readProfile(data));
      setRoleResolved(true);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const actualRole = profile?.role ?? "Unknown";
  const allowedPreviews = useMemo(() => previewable(actualRole), [actualRole]);

  const setCurrentRole = useCallback(
    (role: Role | UserRole) => {
      const canonical = toRole(role);
      setPreviewRole(allowedPreviews.includes(canonical) ? canonical : null);
    },
    [allowedPreviews]
  );

  const value = useMemo<RoleContextValue>(() => {
    const effective =
      previewRole && allowedPreviews.includes(previewRole)
        ? previewRole
        : actualRole;
    const legacy = toUserRole(effective);

    return {
      actualRole,
      effectiveRole: effective,
      currentRole: legacy,
      roleResolved,
      setCurrentRole,
      setRoleFromAuth,
      isPreviewing: effective !== actualRole,
      previewableRoles: allowedPreviews,
      // Narrowed by the preview, but never widened past the real role.
      can: (permission: Permission) =>
        roleCan(actualRole, permission) && roleCan(effective, permission),
      displayName:
        profile?.fullName || profile?.email || ROLE_DISPLAY_NAME[legacy],
      displayRole: ROLE_LABEL[legacy],
      email: profile?.email ?? null,
      loading,
    };
  }, [
    actualRole,
    allowedPreviews,
    loading,
    previewRole,
    profile,
    roleResolved,
    setCurrentRole,
    setRoleFromAuth,
  ]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return ctx;
}

/** Convenience for the common "may I show this button?" check. */
export function usePermission(permission: Permission) {
  return useRole().can(permission);
}
