"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  type Branch,
  type MemberFormState,
  type MembershipPlan,
  calculateExpiryDate,
  emptyMemberForm,
} from "@/components/admin/members/members.types";

type Props = {
  title?: string;
  submitLabel?: string;
  initialValues?: Partial<MemberFormState>;
  branches: Branch[];
  branchesLoading: boolean;
  membershipPlans: MembershipPlan[];
  membershipPlansLoading: boolean;
  onClose: () => void;
  onSubmit: (values: MemberFormState) => Promise<void>;
};

export function CreateMemberModal({
  title = "Add new member",
  submitLabel = "Create member",
  initialValues,
  branches,
  branchesLoading,
  membershipPlans,
  membershipPlansLoading,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<MemberFormState>(emptyMemberForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Sync form state when initialValues changes (edit mode)
  useEffect(() => {
    if (initialValues) {
      setForm((f) => ({ ...f, ...initialValues }));
    } else {
      setForm(emptyMemberForm());
    }
  }, [initialValues]);

  function handleMembershipPlanChange(planId: string) {
    const plan = membershipPlans.find((p) => p.id === planId);
    setForm((f) => ({
      ...f,
      membershipPlanId: planId,
      remainingCredits: plan ? String(plan.credits) : f.remainingCredits,
      expiryDate: plan ? calculateExpiryDate(plan.validityDays) : f.expiryDate,
    }));
  }

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);
      try {
        await onSubmit(form);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to submit";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [form, onSubmit, onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold font-display uppercase text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 text-sm">
            {/* Section 2: Basic Information */}
            <div className="border-b border-border pb-4">
              <h4 className="text-xs uppercase font-bold text-sweat mb-3">Basic Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Full Name <span className="text-red-500">*</span></span>
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    required
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Phone Number <span className="text-red-500">*</span></span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    value={form.phoneNumber}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 13);
                      setForm((f) => ({ ...f, phoneNumber: digits }));
                    }}
                    required
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-gray-500 text-xs uppercase font-bold">Profile Image URL</span>
                  <input
                    type="text"
                    value={form.profileImageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, profileImageUrl: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
              </div>
            </div>

            {/* Section 3: Personal Details */}
            <div className="border-b border-border pb-4">
              <h4 className="text-xs uppercase font-bold text-sweat mb-3">Personal Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Gender <span className="text-red-500">*</span></span>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Date of Birth <span className="text-red-500">*</span></span>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                    style={{ colorScheme: "dark" }}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Height (cm) <span className="text-red-500">*</span></span>
                  <input
                    type="number"
                    min={0}
                    value={form.heightCm}
                    onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Weight (kg) <span className="text-red-500">*</span></span>
                  <input
                    type="number"
                    min={0}
                    value={form.weightKg}
                    onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                  />
                </label>
              </div>
            </div>

            {/* Section 4: Address */}
            <div className="border-b border-border pb-4">
              <h4 className="text-xs uppercase font-bold text-sweat mb-3">Address</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Address <span className="text-red-500">*</span></span>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat resize-y"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">City <span className="text-red-500">*</span></span>
                  <input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                  />
                </label>
              </div>
            </div>

            {/* Section 5: Emergency Contact */}
            <div className="border-b border-border pb-4">
              <h4 className="text-xs uppercase font-bold text-sweat mb-3">Emergency Contact</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Emergency Contact Name <span className="text-red-500">*</span></span>
                  <input
                    value={form.emergencyContactName}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Emergency Contact Phone <span className="text-red-500">*</span></span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    value={form.emergencyContactPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 13);
                      setForm((f) => ({ ...f, emergencyContactPhone: digits }));
                    }}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                  />
                </label>
              </div>
            </div>

            {/* Section 6: Membership Details */}
            <div className="border-b border-border pb-4">
              <h4 className="text-xs uppercase font-bold text-sweat mb-3">Membership Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Membership Source <span className="text-red-500">*</span></span>
                  <input
                    value={form.membershipSource}
                    onChange={(e) => setForm((f) => ({ ...f, membershipSource: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Home Club <span className="text-red-500">*</span></span>
                  <select
                    value={form.homeClubBranchId}
                    onChange={(e) => setForm((f) => ({ ...f, homeClubBranchId: e.target.value }))}
                    disabled={branchesLoading}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat disabled:opacity-50"
                    required
                  >
                    <option value="">{branchesLoading ? "Memuat Home Club..." : "Pilih Home Club..."}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branchName}
                      </option>
                    ))}
                    {!branchesLoading && branches.length === 0 && (
                      <option value="" disabled>Tidak ada branch aktif</option>
                    )}
                    {!branchesLoading && form.homeClubBranchId && !branches.find((b) => b.id === form.homeClubBranchId) && (
                      <option value={form.homeClubBranchId} disabled>
                        ⚠️ Branch tidak ditemukan (ID: {form.homeClubBranchId})
                      </option>
                    )}
                  </select>
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Membership Plan <span className="text-red-500">*</span></span>
                  <select
                    value={form.membershipPlanId}
                    onChange={(e) => handleMembershipPlanChange(e.target.value)}
                    disabled={membershipPlansLoading}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat disabled:opacity-50"
                    required
                  >
                    <option value="">{membershipPlansLoading ? "Memuat plan..." : "Pilih Membership Plan..."}</option>
                    {membershipPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.planName} ({p.credits} credits)
                      </option>
                    ))}
                    {!membershipPlansLoading && membershipPlans.length === 0 && (
                      <option value="" disabled>Tidak ada plan aktif</option>
                    )}
                    {!membershipPlansLoading && form.membershipPlanId && !membershipPlans.find((p) => p.id === form.membershipPlanId) && (
                      <option value={form.membershipPlanId} disabled>
                        ⚠️ Plan tidak ditemukan (ID: {form.membershipPlanId})
                      </option>
                    )}
                  </select>
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Remaining Credits <span className="text-red-500">*</span></span>
                  <input
                    type="number"
                    min={0}
                    value={form.remainingCredits}
                    readOnly
                    className="mt-1 w-full bg-gray-800 border border-border rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Remaining PT Sessions</span>
                  <input
                    type="number"
                    min={0}
                    value={form.remainingPtSessions}
                    onChange={(e) => setForm((f) => ({ ...f, remainingPtSessions: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Expiry Date</span>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    style={{ colorScheme: "dark" }}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Membership Status</span>
                  <select
                    value={form.membershipStatus}
                    onChange={(e) => setForm((f) => ({ ...f, membershipStatus: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  >
                    <option value="">Select...</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Payment Status</span>
                  <select
                    value={form.paymentStatus}
                    onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  >
                    <option value="">Select...</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Failed">Failed</option>
                    <option value="Expired">Expired</option>
                    <option value="Refunded">Refunded</option>
                    <option value="Cancelled">Cancelled</option>

                  </select>
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Freeze Start</span>
                  <input
                    type="datetime-local"
                    value={form.freezeStartDate}
                    onChange={(e) => setForm((f) => ({ ...f, freezeStartDate: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    style={{ colorScheme: "dark" }}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Freeze End</span>
                  <input
                    type="datetime-local"
                    value={form.freezeEndDate}
                    onChange={(e) => setForm((f) => ({ ...f, freezeEndDate: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    style={{ colorScheme: "dark" }}
                  />
                </label>
              </div>
            </div>

            {/* Section 8: Account Status */}
            <div>
              <h4 className="text-xs uppercase font-bold text-sweat mb-3">Account Status</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isWaiverSigned}
                    onChange={(e) => setForm((f) => ({ ...f, isWaiverSigned: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-gray-300">Waiver Signed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPtMember}
                    onChange={(e) => setForm((f) => ({ ...f, isPtMember: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-gray-300">PT Member</span>
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
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat resize-y"
                  />
                </label>
              </div>
            </div>
          </div>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
            >
              {submitting ? "Menyimpan..." : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border border-border text-gray-300 hover:text-white"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
