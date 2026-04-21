"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type User = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  role?: string | null;
  branchName?: string | null;
  profileImageUrl?: string | null;
  isActive?: boolean;
  specialization?: string | null;
  position?: string | null;
};

type Role = {
  id: string;
  name?: string | null;
};

type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  pageSize?: number;
  message?: string;
};

type SortDir = "asc" | "desc";
type SortKey = "fullName" | "email" | "roleName" | "isActive";

type ResetPasswordForm = { newPassword: string };

type UserCrudForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  roleId: string;
  branchName: string;
  position: string;
  specialization: string;
  isActive: boolean;
};

function emptyUserCrudForm(): UserCrudForm {
  return {
    fullName: "",
    email: "",
    phoneNumber: "",
    password: "",
    roleId: "",
    branchName: "",
    position: "",
    specialization: "",
    isActive: true,
  };
}

export function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected, setSelected] = useState<User | null>(null);
  const [resetForm, setResetForm] = useState<ResetPasswordForm | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [userCrud, setUserCrud] = useState<null | { mode: "create" } | { mode: "edit"; id: string }>(null);
  const [crudForm, setCrudForm] = useState<UserCrudForm>(emptyUserCrudForm);
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudMsg, setCrudMsg] = useState("");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const loadUsers = useCallback(async (targetPage: number, keyword: string) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
    if (keyword) params.set("search", keyword);
    const res = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => [])) as User[] | PagedResponse<User>;
    if (!res.ok) {
      setError("Failed to load users");
      setUsers([]);
      setLoading(false);
      return;
    }
    if (Array.isArray(payload)) {
      setUsers(payload);
      setTotalItems(payload.length);
      setTotalPages(1);
    } else {
      const list = payload.data ?? payload.items ?? [];
      const total = payload.totalCount ?? payload.totalItems ?? payload.total ?? list.length;
      const pages = payload.totalPages ?? payload.pageCount ?? Math.max(1, Math.ceil(total / pageSize));
      setUsers(list);
      setTotalItems(total);
      setTotalPages(pages);
    }
    setLoading(false);
  }, [pageSize]);

  const loadRoles = useCallback(async () => {
    const res = await fetch("/api/users/roles", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => []);
      const list: Role[] = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
      setRoles(list);
    }
  }, []);

  useEffect(() => {
    void loadUsers(page, search);
  }, [loadUsers, page, search]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => {
      const av = (a[sortKey] as string | boolean) ?? "";
      const bv = (b[sortKey] as string | boolean) ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleResetPassword(userId: string) {
    if (!resetForm) return;
    setResetLoading(true);
    setResetMsg("");
    const res = await fetch(`/api/users/${userId}/reset-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetForm.newPassword }),
    });
    setResetLoading(false);
    if (res.ok) {
      setResetMsg("Password reset successfully.");
      setResetForm(null);
    } else {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setResetMsg(data.message ?? "Failed to reset password.");
    }
  }

  async function handleToggleStatus(user: User) {
    setStatusLoading(user.id);
    await fetch(`/api/users/${user.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    setStatusLoading(null);
    void loadUsers(page, search);
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeleteId(null);
    setSelected(null);
    void loadUsers(page, search);
  }

  function formFromUserRow(u: User): UserCrudForm {
    return {
      fullName: u.fullName ?? "",
      email: u.email ?? "",
      phoneNumber: u.phoneNumber ?? "",
      password: "",
      roleId:
        u.roleId ??
        roles.find((r) => (r.name ?? "").toLowerCase() === (u.roleName ?? u.role ?? "").toLowerCase())?.id ??
        "",
      branchName: u.branchName ?? "",
      position: u.position ?? "",
      specialization: u.specialization ?? "",
      isActive: u.isActive !== false,
    };
  }

  async function openEditUser(u: User) {
    setCrudMsg("");
    setCrudForm(formFromUserRow(u));
    setUserCrud({ mode: "edit", id: u.id });
    const res = await fetch(`/api/users/${u.id}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as User | null;
      if (data) {
        setCrudForm(formFromUserRow(data));
      }
    }
  }

  async function submitUserCrud() {
    if (!userCrud) return;
    setCrudLoading(true);
    setCrudMsg("");
    try {
      if (userCrud.mode === "create") {
        if (!crudForm.password.trim()) {
          setCrudMsg("Password wajib diisi untuk user baru.");
          setCrudLoading(false);
          return;
        }
        const body: Record<string, unknown> = {
          fullName: crudForm.fullName || null,
          email: crudForm.email || null,
          phoneNumber: crudForm.phoneNumber || null,
          password: crudForm.password,
          roleId: crudForm.roleId || null,
          branchName: crudForm.branchName || null,
          position: crudForm.position || null,
          specialization: crudForm.specialization || null,
          isActive: crudForm.isActive,
        };
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({})) as { message?: string };
        if (!res.ok) {
          setCrudMsg(data.message ?? "Gagal membuat user.");
          return;
        }
        setUserCrud(null);
        void loadUsers(page, search);
        return;
      }
      const body: Record<string, unknown> = {
        fullName: crudForm.fullName || null,
        email: crudForm.email || null,
        phoneNumber: crudForm.phoneNumber || null,
        roleId: crudForm.roleId || null,
        branchName: crudForm.branchName || null,
        position: crudForm.position || null,
        specialization: crudForm.specialization || null,
        isActive: crudForm.isActive,
      };
      if (crudForm.password.trim()) {
        body.password = crudForm.password;
      }
      const res = await fetch(`/api/users/${userCrud.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) {
        setCrudMsg(data.message ?? "Gagal memperbarui user.");
        return;
      }
      setUserCrud(null);
      void loadUsers(page, search);
    } finally {
      setCrudLoading(false);
    }
  }

  const roleLabel = (u: User) => u.roleName ?? u.role ?? roles.find((r) => r.id === u.roleId)?.name ?? "—";

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:items-stretch">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search users..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 bg-sidebar border border-border rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sweat"
          />
          <button
            type="submit"
            className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition shrink-0"
          >
            Search
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setCrudMsg("");
            setCrudForm({ ...emptyUserCrudForm(), roleId: roles[0]?.id ?? "" });
            setUserCrud({ mode: "create" });
          }}
          className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 shrink-0"
        >
          <i className="fas fa-user-plus" aria-hidden />
          Add user
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-400">Loading users...</div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-gray-400">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm text-gray-400">
              <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                <tr>
                  {(
                    [
                      { label: "User", key: "fullName" },
                      { label: "Role", key: "roleName" },
                      { label: "Branch", key: null },
                      { label: "Status", key: "isActive" },
                    ] as { label: string; key: SortKey | null }[]
                  ).map(({ label, key }) => (
                    <th key={label} className="px-6 py-4">
                      {key ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className="flex items-center gap-1.5 hover:text-white transition group"
                        >
                          {label}
                          <span className="flex flex-col leading-none text-[10px]">
                            <i className={`fas fa-caret-up ${sortKey === key && sortDir === "asc" ? "text-sweat" : "text-gray-600 group-hover:text-gray-400"}`} aria-hidden />
                            <i className={`fas fa-caret-down ${sortKey === key && sortDir === "desc" ? "text-sweat" : "text-gray-600 group-hover:text-gray-400"}`} aria-hidden />
                          </span>
                        </button>
                      ) : label}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((u) => (
                  <tr key={u.id} className="table-row transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Image
                          src={u.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || "User")}&background=random`}
                          alt=""
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full"
                          unoptimized
                        />
                        <div>
                          <p className="font-medium text-white">{u.fullName ?? "—"}</p>
                          <p className="text-xs text-gray-500">{u.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{roleLabel(u)}</td>
                    <td className="px-6 py-4">{u.branchName ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${u.isActive ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-gray-500/10 text-gray-400 border-gray-600/20"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => void openEditUser(u)}
                          className="text-xs text-black bg-sweat hover:bg-yellow-400 border border-sweat px-2 py-1 rounded font-bold transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelected(u); setResetMsg(""); }}
                          className="text-xs text-gray-400 hover:text-white border border-border px-2 py-1 rounded transition"
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(u)}
                          disabled={statusLoading === u.id}
                          className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-500/20 px-2 py-1 rounded transition disabled:opacity-50"
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(u.id)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-gray-400">
            Page {page} of {Math.max(1, totalPages)} • {totalItems} total
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="bg-sidebar border border-border text-white px-3 py-1.5 rounded text-xs disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="bg-sidebar border border-border text-white px-3 py-1.5 rounded text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => { if (e.currentTarget === e.target) { setSelected(null); setResetForm(null); setResetMsg(""); } }}
        >
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase">User Detail</h3>
              <button type="button" onClick={() => { setSelected(null); setResetForm(null); setResetMsg(""); }} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <Image
                src={selected.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selected.fullName || "User")}&background=random`}
                alt=""
                width={56}
                height={56}
                className="w-14 h-14 rounded-full"
                unoptimized
              />
              <div>
                <p className="font-bold text-white">{selected.fullName ?? "—"}</p>
                <p className="text-sm text-gray-400">{selected.email ?? "—"}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-300 mb-4">
              {[
                ["Phone", selected.phoneNumber],
                ["Role", roleLabel(selected)],
                ["Branch", selected.branchName],
                ["Position", selected.position],
                ["Specialization", selected.specialization],
                ["Status", selected.isActive ? "Active" : "Inactive"],
              ].map(([label, val]) =>
                val != null ? (
                  <p key={String(label)}><span className="text-gray-500">{label}:</span> {String(val)}</p>
                ) : null
              )}
            </div>

            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setResetForm({ newPassword: "" })}
                className="text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-2"
              >
                <i className="fas fa-key" aria-hidden /> Reset Password
              </button>
              {resetForm && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="password"
                    placeholder="New password"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ newPassword: e.target.value })}
                    className="flex-1 bg-sidebar border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sweat"
                  />
                  <button
                    type="button"
                    disabled={resetLoading || !resetForm.newPassword}
                    onClick={() => void handleResetPassword(selected.id)}
                    className="bg-sweat text-black px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50"
                  >
                    {resetLoading ? "..." : "Set"}
                  </button>
                </div>
              )}
              {resetMsg && <p className={`mt-2 text-xs ${resetMsg.includes("success") ? "text-green-400" : "text-red-400"}`}>{resetMsg}</p>}
            </div>
          </div>
        </div>
      )}

      {userCrud && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserCrud(null);
          }}
        >
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase">
                {userCrud.mode === "create" ? "Add user" : "Edit user"}
              </h3>
              <button
                type="button"
                onClick={() => setUserCrud(null)}
                className="text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Full name</span>
                <input
                  value={crudForm.fullName}
                  onChange={(e) => setCrudForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Email</span>
                <input
                  type="email"
                  value={crudForm.email}
                  onChange={(e) => setCrudForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Phone</span>
                <input
                  value={crudForm.phoneNumber}
                  onChange={(e) => setCrudForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">
                  {userCrud.mode === "create" ? "Password" : "Password (opsional)"}
                </span>
                <input
                  type="password"
                  value={crudForm.password}
                  onChange={(e) => setCrudForm((f) => ({ ...f, password: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  placeholder={userCrud.mode === "edit" ? "Kosongkan jika tidak diubah" : ""}
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Role</span>
                <select
                  value={crudForm.roleId}
                  onChange={(e) => setCrudForm((f) => ({ ...f, roleId: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                >
                  <option value="">— Pilih role —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name ?? r.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Branch</span>
                <input
                  value={crudForm.branchName}
                  onChange={(e) => setCrudForm((f) => ({ ...f, branchName: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Position</span>
                <input
                  value={crudForm.position}
                  onChange={(e) => setCrudForm((f) => ({ ...f, position: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Specialization</span>
                <input
                  value={crudForm.specialization}
                  onChange={(e) => setCrudForm((f) => ({ ...f, specialization: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={crudForm.isActive}
                  onChange={(e) => setCrudForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-gray-300">Active</span>
              </label>
            </div>
            {crudMsg && <p className="mt-3 text-xs text-red-400">{crudMsg}</p>}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={crudLoading}
                onClick={() => void submitUserCrud()}
                className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
              >
                {crudLoading ? "Menyimpan…" : userCrud.mode === "create" ? "Create user" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setUserCrud(null)}
                className="px-4 py-2 rounded-lg text-sm border border-border text-gray-300 hover:text-white"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-red-500/30 shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-2">Delete User?</h3>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleDelete(deleteId)}
                disabled={deleteLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 bg-sidebar border border-border text-white py-2 rounded-lg text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
