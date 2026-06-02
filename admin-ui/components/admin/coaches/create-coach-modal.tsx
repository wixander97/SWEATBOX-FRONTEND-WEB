"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

type AddForm = {
  userId: string;
  branchId: string;
  specialization: string;
  bio: string;
  rating: string;
  attendanceRate: string;
  totalClasses: string;
  totalMembers: string;
  totalPtSessions: string;
  payrollType: string;
  payrollRate: string;
  certification: string;
  emergencyContact: string;
  isActive: boolean;
};

type UserOption = {
  id: string;
  fullName?: string | null;
  email?: string | null;
};

type BranchOption = {
  id: string;
  branchName?: string | null;
  isActive: boolean;
};

type CreateCoachModalProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export function CreateCoachModal({ onClose, onSuccess }: CreateCoachModalProps) {
  const [form, setForm] = useState<AddForm>({
    userId: "",
    branchId: "",
    specialization: "",
    bio: "",
    rating: "0",
    attendanceRate: "0",
    totalClasses: "0",
    totalMembers: "0",
    totalPtSessions: "0",
    payrollType: "",
    payrollRate: "0",
    certification: "",
    emergencyContact: "",
    isActive: true,
  });

  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load users and branches on mount
  useState(() => {
    async function loadData() {
      // Load users
      setUsersLoading(true);
      const userParams = new URLSearchParams({ page: "1", pageSize: "100", isActive: "true", roleId: "6a3efc88-def9-4b73-b328-9570b704341d" });
      const userRes = await authFetch(`/api/v1/users/paged?${userParams.toString()}`, { cache: "no-store" });
      if (userRes.ok) {
        const userPayload = await userRes.json().catch(() => ({}));
        let userList: UserOption[] = [];
        if (Array.isArray(userPayload)) {
          userList = userPayload as UserOption[];
        } else if (userPayload.data && Array.isArray(userPayload.data)) {
          userList = userPayload.data;
        } else if (userPayload.items && Array.isArray(userPayload.items)) {
          userList = userPayload.items;
        }
        setUsers(userList);
      }
      setUsersLoading(false);

      // Load branches
      setBranchesLoading(true);
      const branchRes = await authFetch(`${API_BASE_URL}/api/v1/branches`);
      if (branchRes.ok) {
        const branchPayload = await branchRes.json().catch(() => []);
        let branchList: BranchOption[] = [];
        if (Array.isArray(branchPayload)) {
          branchList = branchPayload as BranchOption[];
        } else if (branchPayload.data && Array.isArray(branchPayload.data)) {
          branchList = branchPayload.data;
        } else if (branchPayload.items && Array.isArray(branchPayload.items)) {
          branchList = branchPayload.items;
        }
        setBranches(branchList);
      }
      setBranchesLoading(false);
    }
    void loadData();
  });

  async function handleSubmit() {
    if (!form.userId) {
      setError("Please select a user.");
      return;
    }
    if (!form.specialization.trim()) {
      setError("Specialization is required.");
      return;
    }

    setLoading(true);
    setError("");

    const body = {
      userId: form.userId,
      branchId: form.branchId || undefined,
      specialization: form.specialization,
      bio: form.bio || undefined,
      rating: Number(form.rating) || 0,
      attendanceRate: Number(form.attendanceRate) || 0,
      totalClasses: Number(form.totalClasses) || 0,
      totalMembers: Number(form.totalMembers) || 0,
      totalPtSessions: Number(form.totalPtSessions) || 0,
      payrollType: form.payrollType || undefined,
      payrollRate: Number(form.payrollRate) || 0,
      certification: form.certification || undefined,
      emergencyContact: form.emergencyContact || undefined,
      isActive: form.isActive,
    };

    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({})) as { message?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.message ?? "Failed to create coach");
      return;
    }

    onSuccess();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold font-display uppercase">Add New Coach</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {/* User Selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              User <span className="text-red-400">*</span>
            </label>
            <select
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              disabled={usersLoading}
              className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat disabled:opacity-50"
            >
              <option value="">{usersLoading ? "Loading users..." : "Select a user"}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName ?? "—"}{u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Text fields */}
          {([
            ["Specialization", "specialization", true],
            ["Bio", "bio", false],
            ["Certification", "certification", false],
            ["Emergency Contact", "emergencyContact", false],
          ] as [string, keyof AddForm, boolean][]).map(([label, field]) => (
            <div key={field}>
              <label className="block text-xs text-gray-400 mb-1">
                {label}{field === "specialization" ? <span className="text-red-400">*</span> : null}
              </label>
              <input
                type="text"
                value={String(form[field])}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
              />
            </div>
          ))}

          {/* Payroll Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Payroll Type</label>
            <select
              value={form.payrollType}
              onChange={(e) => setForm((f) => ({ ...f, payrollType: e.target.value }))}
              className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
            >
              <option value="">— Select type —</option>
              <option value="Hourly">Hourly</option>
              <option value="Daily">Daily</option>
              <option value="Monthly">Monthly</option>
              <option value="Fixed">Fixed</option>
            </select>
          </div>

          {/* Payroll Rate */}
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

          {/* Branch Selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Branch</label>
            <select
              value={form.branchId}
              onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
              disabled={branchesLoading}
              className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat disabled:opacity-50"
            >
              <option value="">{branchesLoading ? "Loading branches..." : "Select a branch"}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branchName ?? "—"}
                </option>
              ))}
            </select>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {([
              ["Rating", "rating"],
              ["Attendance Rate", "attendanceRate"],
              ["Total Classes", "totalClasses"],
              ["Total Members", "totalMembers"],
              ["Total PT Sessions", "totalPtSessions"],
            ] as [string, keyof AddForm][]).map(([label, field]) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  type="number"
                  value={String(form[field])}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
                />
              </div>
            ))}
          </div>

          {/* Active Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="addIsActive"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="addIsActive" className="text-sm text-gray-300">Active</label>
          </div>

          {/* Error Message */}
          {error && <p className="text-red-400 text-xs">{error}</p>}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Coach"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-sidebar border border-border text-white py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}