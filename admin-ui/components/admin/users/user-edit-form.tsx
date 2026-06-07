"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth/client-fetch";
import { API_BASE_URL } from "@/lib/auth/constants";
import type { Branch, Role, UserCrudForm } from "./users.types";

type Props = {
  userId: string;
  initialForm: UserCrudForm;
  roles: Role[];
  branches: Branch[];
  currentUserId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function UserEditForm({ userId, initialForm, roles, branches, currentUserId, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState<UserCrudForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setMsg("");
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber || "",
        roleId: form.roleId || "",
        branchId: form.branchId || "",
        profileImageUrl: form.profileImageUrl || "",
        notes: form.notes || "",
        specialization: form.specialization || "",
        bio: form.bio || "",
        payrollType: form.payrollType || "",
        payrollRate: form.payrollRate === "" ? 0 : Number(form.payrollRate),
        position: form.position || "",
        department: form.department || "",
        salary: form.salary === "" ? 0 : Number(form.salary),
        isActive: form.isActive,
      };
      const res = await authFetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) {
        setMsg(data.message ?? "Gagal memperbarui user.");
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold font-display uppercase">Edit user</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Full Name</span>
          <input
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Role</span>
          <select
            value={form.roleId}
            onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          >
            <option value="">— Pilih role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name ?? r.id}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Phone</span>
          <input
            value={form.phoneNumber}
            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Position</span>
          <input
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Department</span>
          <input
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Branch</span>
          <select
            value={form.branchId}
            onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          >
            <option value="">— Pilih branch —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.branchName}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Specialization</span>
          <input
            value={form.specialization}
            onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat resize-none"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Bio</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={2}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat resize-none"
          />
        </label>
<label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Payroll Type</span>
          <input
            type="text"
            value={form.payrollType}
            onChange={(e) => setForm((f) => ({ ...f, payrollType: e.target.value }))}
            placeholder="e.g. Hourly, Daily, Monthly"
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Payroll Rate</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.payrollRate}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setForm((f) => ({ ...f, payrollRate: raw }));
            }}
            placeholder="0"
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">Salary (Rp)</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.salary}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setForm((f) => ({ ...f, salary: raw }));
            }}
            placeholder="0"
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
          />
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="rounded border-border"
          />
          <span className="text-gray-300">Active</span>
        </label>
      </div>
      {msg && <p className="mt-3 text-xs text-red-400">{msg}</p>}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleSubmit()}
          className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
        >
          {loading ? "Menyimpan…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm border border-border text-gray-300 hover:text-white"
        >
          Batal
        </button>
      </div>
    </div>
  );
}