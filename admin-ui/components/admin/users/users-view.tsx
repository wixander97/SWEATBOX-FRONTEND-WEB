"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import type { Role, Branch } from "./users.types";
import { UserCreateForm } from "./user-create-form";
import { StaffsView, type StaffsViewHandle } from "@/components/admin/staffs/staffs-view";
import { CoachesView, type CoachesViewHandle } from "@/components/admin/coaches/coaches-view";

type Tab = "staff" | "coach";

export function UsersView() {
  const [tab, setTab] = useState<Tab>("staff");
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const staffRef = useRef<StaffsViewHandle>(null);
  const coachRef = useRef<CoachesViewHandle>(null);

  const loadRoles = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/v1/users/roles`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => []);
      const list: Role[] = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
      setRoles(list);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/v1/branches`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => []);
      const list: Branch[] = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
      setBranches(list);
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/v1/auth/profile`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => ({})) as { userId?: string };
      if (data.userId) setCurrentUserId(data.userId);
    }
  }, []);

  useEffect(() => { void loadRoles(); }, [loadRoles]);
  useEffect(() => { void loadBranches(); }, [loadBranches]);
  useEffect(() => { void loadCurrentUser(); }, [loadCurrentUser]);

  // Roles filtered to the active tab only (staff tab -> staff role, coach tab -> coach role).
  const tabRoles = useMemo(
    () => roles.filter((r) => (r.name ?? "").toLowerCase() === tab),
    [roles, tab],
  );

  function handleCreateSuccess() {
    setShowCreate(false);
    if (tab === "staff") staffRef.current?.reload();
    else coachRef.current?.reload();
  }

  const tabBtnCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold border transition ${
      active
        ? "bg-sweat text-black border-sweat"
        : "bg-sidebar text-gray-400 border-border hover:text-white hover:border-gray-500"
    }`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("staff")}
            className={tabBtnCls(tab === "staff")}
          >
            <i className="fas fa-user-tie mr-2" aria-hidden />
            Staff
          </button>
          <button
            type="button"
            onClick={() => setTab("coach")}
            className={tabBtnCls(tab === "coach")}
          >
            <i className="fas fa-dumbbell mr-2" aria-hidden />
            Coach
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 shrink-0"
        >
          <i className="fas fa-user-plus" aria-hidden />
          Add {tab === "staff" ? "Staff" : "Coach"}
        </button>
      </div>

      {tab === "staff" ? <StaffsView ref={staffRef} /> : <CoachesView ref={coachRef} />}

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <UserCreateForm
            roles={tabRoles}
            branches={branches}
            currentUserId={currentUserId}
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}
    </div>
  );
}