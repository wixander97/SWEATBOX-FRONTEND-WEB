"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

export type CoachDetail = {
  id: string;
  fullName?: string | null;
  specialization?: string | null;
  profileImageUrl?: string | null;
  rating?: number;
  totalClasses?: number;
  totalMembers?: number;
  isActive?: boolean;
  branchName?: string | null;
  branchId?: string | null;
  payrollType?: string | null;
  payrollRate?: number;
  email?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  certification?: string | null;
  emergencyContact?: string | null;
  attendanceRate?: number;
  totalPtSessions?: number;
};

type EditForm = {
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

type BranchOption = {
  id: string;
  branchName?: string | null;
  isActive: boolean;
};

type EditCoachModalProps = {
  coach: CoachDetail;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditCoachModal({ coach, onClose, onSuccess }: EditCoachModalProps) {
  const [form, setForm] = useState<EditForm>({
    branchId: coach.branchId ?? "",
    specialization: coach.specialization ?? "",
    bio: coach.bio ?? "",
    rating: String(coach.rating ?? "0"),
    attendanceRate: String(coach.attendanceRate ?? "0"),
    totalClasses: String(coach.totalClasses ?? "0"),
    totalMembers: String(coach.totalMembers ?? "0"),
    totalPtSessions: String(coach.totalPtSessions ?? "0"),
    payrollType: coach.payrollType ?? "",
    payrollRate: String(coach.payrollRate ?? "0"),
    certification: coach.certification ?? "",
    emergencyContact: coach.emergencyContact ?? "",
    isActive: coach.isActive ?? true,
  });

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load branches on mount
  useEffect(() => {
    async function loadBranches() {
      setBranchesLoading(true);
      const res = await authFetch(`${API_BASE_URL}/api/v1/branches`);
      if (res.ok) {
        const payload = await res.json().catch(() => []);
        let list: BranchOption[] = [];
        if (Array.isArray(payload)) {
          list = payload as BranchOption[];
        } else if (payload.data && Array.isArray(payload.data)) {
          list = payload.data;
        } else if (payload.items && Array.isArray(payload.items)) {
          list = payload.items;
        }
        setBranches(list);
      }
      setBranchesLoading(false);
    }
    void loadBranches();
  }, []);

  async function handleSubmit() {
    setError("");
    if (!form.branchId.trim()) {
      setError("Branch wajib diisi");
      return;
    }
    setLoading(true);

    const body = {
      branchId: form.branchId,
      specialization: form.specialization || undefined,
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

    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches/${coach.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({})) as { message?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.message ?? "Failed to update coach");
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
          <h3 className="text-xl font-bold font-display uppercase">Edit Coach</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {/* Branch Selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Branch <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={form.branchId}
              onChange={(e) => {
                setForm((f) => ({ ...f, branchId: e.target.value }));
                if (error) setError("");
              }}
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

          {/* Text fields */}
          {([
            ["Specialization", "specialization"],
            ["Bio", "bio"],
            ["Certification", "certification"],
            ["Emergency Contact", "emergencyContact"],
          ] as [string, keyof EditForm][]).map(([label, field]) => (
            <div key={field}>
              <label className="block text-xs text-gray-400 mb-1">
                {label}{field === "specialization" ? <span className="text-red-400">*</span> : null}
              </label>
              <input
                type="text"
                inputMode={field === "emergencyContact" ? "numeric" : undefined}
                maxLength={field === "emergencyContact" ? 13 : undefined}
                value={String(form[field])}
                onChange={(e) => {
                  const v =
                    field === "emergencyContact"
                      ? e.target.value.replace(/[^0-9]/g, "").slice(0, 13)
                      : e.target.value;
                  setForm((f) => ({ ...f, [field]: v }));
                }}
                required={field === "specialization"}
                className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
              />
            </div>
          ))}

          {/* Payroll Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Payroll Type</label>
            <input
              type="text"
              value={form.payrollType}
              onChange={(e) => setForm((f) => ({ ...f, payrollType: e.target.value }))}
              placeholder="e.g. Hourly, Daily, Monthly"
              className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
            />
          </div>

          {/* Payroll Rate */}
          <label className="block">
            <span className="text-gray-500 text-xs uppercase font-bold">Payroll Rate</span>
            <input
              type="text"
              inputMode="decimal"
              value={formatCurrencyInput(Number(form.payrollRate) || 0)}
              onChange={(e) => {
                const num = parseCurrencyInput(e.target.value);
                setForm((f) => ({ ...f, payrollRate: String(num) }));
              }}
              placeholder="0"
              className="w-full bg-sidebar border border-border rounded-lg pl-3 pr-3 py-2 text-white focus:outline-none focus:border-sweat"
            />
          </label>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {([
              ["Rating", "rating"],
              ["Attendance Rate", "attendanceRate"],
              ["Total Classes", "totalClasses"],
              ["Total Members", "totalMembers"],
              ["Total PT Sessions", "totalPtSessions"],
            ] as [string, keyof EditForm][]).map(([label, field]) => (
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
              id="editIsActive"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="editIsActive" className="text-sm text-gray-300">Active</label>
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
              {loading ? "Saving..." : "Save Changes"}
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