"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import {
  type Branch,
  type StaffDetail,
  type StaffEditForm,
  emptyStaffEditForm,
  staffToEditForm,
} from "@/components/admin/staffs/staffs.types";

type Props = {
  staffId: string;
  branches: Branch[];
  branchesLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditStaffModal({
  staffId,
  branches,
  branchesLoading,
  onClose,
  onSuccess,
}: Props) {
  const [form, setForm] = useState<StaffEditForm>(emptyStaffEditForm());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      setError("");
      const res = await authFetch(`${API_BASE_URL}/api/v1/staffs/${staffId}`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) {
        setLoading(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as StaffDetail & {
        data?: StaffDetail;
        message?: string;
      };
      if (!res.ok) {
        setError(data?.message ?? "Gagal mengambil detail staff.");
        setLoading(false);
        return;
      }
      const detail = (data.data ?? data) as StaffDetail;
      if (!cancelled) setForm(staffToEditForm(detail));
      setLoading(false);
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setSaveError("");
      const body: Record<string, unknown> = {
        branchId: form.branchId,
        phoneNumber: form.phoneNumber,
        position: form.position,
        department: form.department,
        hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : null,
        salary: Number(form.salary) || 0,
        isActive: form.isActive,
      };
      const res = await authFetch(`${API_BASE_URL}/api/v1/staffs/${staffId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (redirectToLoginIfUnauthorized(res.status)) {
        setSaving(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setSaveError(data.message ?? "Gagal memperbarui staff.");
        setSaving(false);
        return;
      }
      setSaving(false);
      onSuccess();
    },
    [form, staffId, onSuccess]
  );

  const inputCls =
    "bg-sidebar border border-border text-white px-3 py-2 rounded-lg text-sm w-full focus:outline-none focus:border-sweat";
  const labelCls = "block text-gray-500 text-xs uppercase font-bold mb-1";

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border sticky top-0 bg-card">
          <h3 className="text-xl font-bold font-display uppercase">Edit Staff</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <p className="text-gray-400">Loading detail...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    className={inputCls}
                    value={form.phoneNumber}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        phoneNumber: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="0812..."
                  />
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <input
                    className={inputCls}
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Position</label>
                  <input
                    className={inputCls}
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Branch</label>
                  <select
                    className={inputCls}
                    value={form.branchId}
                    onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                    disabled={branchesLoading}
                  >
                    <option value="">
                      {branchesLoading ? "Memuat Branch..." : "Pilih Branch..."}
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branchName ?? b.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Hire Date</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.hireDate}
                    onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Salary</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputCls} pl-10`}
                      value={form.salary === "" ? "" : formatCurrencyInput(Number(form.salary))}
                      onChange={(e) => {
                        const num = parseCurrencyInput(e.target.value);
                        setForm((f) => ({
                          ...f,
                          salary: /[0-9]/.test(e.target.value) ? String(num) : "",
                        }));
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="accent-sweat"
                />
                Active
              </label>

              {saveError && <p className="text-red-400 text-sm">{saveError}</p>}

              <div className="flex gap-3 pt-2 border-t border-border">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-sidebar border border-border text-white py-2 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
