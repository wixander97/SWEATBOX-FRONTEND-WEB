"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

type MembershipPlan = {
  id: string;
  planName?: string | null;
  price?: number;
  isActive?: boolean;
};

type PaymentForm = {
  membershipPlanId: string;
  paymentMethod: string;
  notes: string;
};

type CreatePaymentModalProps = {
  onClose: () => void;
  onSuccess: () => void;
};

const PAYMENT_METHODS = [
  { value: "0", label: "Cash" },
  { value: "1", label: "Bank Transfer" },
  { value: "2", label: "QRIS" },
  { value: "3", label: "Credit Card" },
  { value: "4", label: "Debit Card" },
  { value: "5", label: "E-Wallet" },
  { value: "6", label: "Virtual Account" },
];

export function CreatePaymentModal({ onClose, onSuccess }: CreatePaymentModalProps) {
  const [form, setForm] = useState<PaymentForm>({
    membershipPlanId: "",
    paymentMethod: "",
    notes: "",
  });

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      // Fetch membership plans
      setPlansLoading(true);
      const planRes = await authFetch(`${API_BASE_URL}/api/v1/membership-plans`);
      if (planRes.ok) {
        const planPayload = await planRes.json().catch(() => []);
        let planList: MembershipPlan[] = [];
        if (Array.isArray(planPayload)) {
          planList = planPayload as MembershipPlan[];
        } else if (planPayload.items && Array.isArray(planPayload.items)) {
          planList = planPayload.items;
        } else if (planPayload.data && Array.isArray(planPayload.data)) {
          planList = planPayload.data;
        }
        // Filter only active plans
        setPlans(planList.filter((p) => p.isActive !== false));
      }
      setPlansLoading(false);
    }
    void loadData();
  }, []);

  async function handleSubmit() {
    if (!form.membershipPlanId) {
      setError("Please select a membership plan");
      return;
    }
    if (!form.paymentMethod) {
      setError("Please select a payment method");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Auto-calculate paymentProvider
      const paymentMethodNum = parseInt(form.paymentMethod, 10);
      const paymentProvider = paymentMethodNum === 0 ? 0 : 1;

      const body = {
        membershipPlanId: form.membershipPlanId,
        paymentMethod: paymentMethodNum,
        paymentProvider,
        notes: form.notes,
      };

      const res = await authFetch(`${API_BASE_URL}/api/v1/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as { message?: string; redirectUrl?: string };
      if (!res.ok) {
        setError(data.message || "Failed to create payment");
        return;
      }

      // Handle Midtrans redirect for non-cash payments
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
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
          <h3 className="text-xl font-bold font-display uppercase">Create Payment</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {/* Membership Plan Selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Membership Plan</label>
            <select
              value={form.membershipPlanId}
              onChange={(e) => setForm((f) => ({ ...f, membershipPlanId: e.target.value }))}
              disabled={plansLoading}
              className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat disabled:opacity-50"
            >
              <option value="">{plansLoading ? "Loading plans..." : "Select a plan"}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.planName ?? "—"}
                  {p.price ? ` - Rp ${p.price.toLocaleString("id-ID")}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Payment Method</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
            >
              <option value="">Select payment method</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes (Optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
              placeholder="Add any notes about this payment..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || plansLoading}
              className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Payment"}
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
