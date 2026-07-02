"use client";

import { useState, useEffect, useRef } from "react";
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

type PollingStatus = 'waiting' | 'success' | 'failed' | 'timeout' | null;

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
  const [polling, setPolling] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef(0);
  const midtransWindowRef = useRef<Window | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadData() {

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

        setPlans(planList.filter((p) => p.isActive !== false));
      }
      setPlansLoading(false);
    }
    void loadData();
  }, []);

  // Polling function to check payment status
  async function pollPaymentStatus(paymentId: string) {
    const MAX_ATTEMPTS = 120; // 10 minutes (5s * 120)

    pollingIntervalRef.current = setInterval(async () => {
      pollingAttemptsRef.current += 1;

      // Timeout check
      if (pollingAttemptsRef.current >= MAX_ATTEMPTS) {
        stopPolling('timeout');
        return;
      }

      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/payments/${paymentId}`, {
          cache: "no-store"
        });

        if (!res.ok) {
          console.error('Polling failed:', res.status);
          return; // Continue polling on error
        }

        const payment = await res.json();
        const status = payment.paymentStatus;

        if (status === 1) { // Paid
          stopPolling('success');
        } else if (status === -1) { // Failed
          stopPolling('failed');
        }
        // status === 0 (pending) - continue polling
      } catch (err) {
        console.error('Polling error:', err);
        // Continue polling on network error
      }
    }, 5000); // Poll every 5 seconds
  }

  function stopPolling(finalStatus: 'success' | 'failed' | 'timeout') {
    // Clear interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Close Midtrans tab
    if (midtransWindowRef.current && !midtransWindowRef.current.closed) {
      try {
        midtransWindowRef.current.close();
      } catch (err) {
        console.warn('Could not close Midtrans tab:', err);
      }
    }

    // Update status
    setPollingStatus(finalStatus);
    setPolling(false);

    // Handle final status
    if (finalStatus === 'success') {
      // Show success message for 2 seconds, then close modal
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } else if (finalStatus === 'failed') {
      // Show error message for 2 seconds, then close modal
      setTimeout(() => {
        onSuccess(); // Refresh list to show failed status
        onClose();
      }, 2000);
    } else if (finalStatus === 'timeout') {
      // Show timeout message for 3 seconds, then close modal
      setTimeout(() => {
        onSuccess(); // Refresh list
        onClose();
      }, 3000);
    }
  }

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

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        redirectUrl?: string
      };

      if (!res.ok) {
        setError(data.message || "Failed to create payment");
        return;
      }

      // Defensive check for payment ID
      if (!data.id) {
        setError("Payment created but cannot track status. Please check payment list manually.");
        onSuccess();
        setTimeout(onClose, 2000);
        return;
      }

      // Cash payment — no Midtrans, immediate success
      if (paymentMethodNum === 0) {
        setPolling(true);
        setPollingStatus('success');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
        return;
      }

      // Open Midtrans in new tab and store reference
      if (data.redirectUrl) {
        midtransWindowRef.current = window.open(data.redirectUrl, '_blank');
      }

      // Start polling for payment status
      setPolling(true);
      setPollingStatus('waiting');
      pollPaymentStatus(data.id);

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
        if (e.currentTarget === e.target && !polling) onClose();
      }}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold font-display uppercase">Create Payment</h3>
          {!polling && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              ×
            </button>
          )}
        </div>

        {/* Polling Status Display */}
        {polling && pollingStatus && (
          <div className="space-y-3">
            {pollingStatus === 'waiting' && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                  <div>
                    <p className="text-blue-500 font-semibold text-sm">Waiting for payment...</p>
                    <p className="text-gray-400 text-xs mt-1">Please complete payment in the Midtrans tab</p>
                  </div>
                </div>
              </div>
            )}

            {pollingStatus === 'success' && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-green-500 text-2xl">✓</div>
                  <div>
                    <p className="text-green-500 font-semibold text-sm">Payment successful!</p>
                    <p className="text-gray-400 text-xs mt-1">This window will close automatically...</p>
                  </div>
                </div>
              </div>
            )}

            {pollingStatus === 'failed' && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-red-500 text-2xl">✗</div>
                  <div>
                    <p className="text-red-500 font-semibold text-sm">Payment failed</p>
                    <p className="text-gray-400 text-xs mt-1">This window will close automatically...</p>
                  </div>
                </div>
              </div>
            )}

            {pollingStatus === 'timeout' && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-yellow-500 text-2xl">⏱</div>
                  <div>
                    <p className="text-yellow-500 font-semibold text-sm">Payment timeout</p>
                    <p className="text-gray-400 text-xs mt-1">Please check payment status manually in the payment list</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form - Hidden during polling */}
        {!polling && (
          <div className="space-y-3">
            {/* Membership Plan Selection */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Membership Plan <span className="text-red-400">*</span></label>
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
                    {p.price ? ` - ${p.price.toLocaleString("id-ID")}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Selection */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Payment Method <span className="text-red-400">*</span></label>
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
        )}
      </div>
    </div>
  );
}
