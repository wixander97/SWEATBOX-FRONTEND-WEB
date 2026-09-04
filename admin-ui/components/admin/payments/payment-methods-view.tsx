"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type PaymentAdminItem = {
  id: string;
  provider: number;
  providerName?: string | null;
  paymentMethod: number;
  paymentMethodName?: string | null;
  externalCode?: number | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

type RowState = {
  id: string;
  providerName: string;
  paymentMethodName: string;
  isActive: boolean;
};

function toRowState(p: PaymentAdminItem): RowState {
  return {
    id: p.id,
    providerName: p.providerName ?? "-",
    paymentMethodName: p.paymentMethodName ?? "-",
    isActive: p.isActive ?? true,
  };
}

export function PaymentMethodsView() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const loadPaymentMethods = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/payments/admin`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => [])) as
        | PaymentAdminItem[]
        | { data?: PaymentAdminItem[]; items?: PaymentAdminItem[] };
      if (!res.ok) {
        setRows([]);
        const msg =
          !Array.isArray(payload) && payload && "message" in payload
            ? (payload as { message?: string }).message
            : undefined;
        setError(msg ?? "Failed to load payment methods");
        return;
      }
      const list = Array.isArray(payload)
        ? payload
        : (payload.data ?? payload.items ?? []);
      setRows(list.map(toRowState));
    } catch {
      setError("Failed to load payment methods");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPaymentMethods();
  }, [loadPaymentMethods]);

  async function toggleActive(row: RowState) {
    const next = !row.isActive;
    setStatusError("");
    setStatusLoading(row.id);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/payments/admin/${encodeURIComponent(row.id)}/status`,
        {
          method: "PUT",
          // Bare boolean body (no JSON key) per endpoint contract.
          // authFetch auto-sets Content-Type: application/json for string bodies.
          body: JSON.stringify(next),
          cache: "no-store",
        }
      );
      if (redirectToLoginIfUnauthorized(res.status)) {
        setStatusLoading(null);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setStatusError(data?.message ?? "Failed to update payment method status");
      }
    } catch {
      setStatusError("Failed to update payment method status");
    } finally {
      setStatusLoading(null);
      // Re-fetch to reflect server truth (reverts on failure, updates on success).
      void loadPaymentMethods();
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display uppercase text-fg">
            Payment Methods
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage the available payment methods.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-danger text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {statusError && (
        <div className="bg-red-500/10 border border-red-500/30 text-danger text-sm px-4 py-2 rounded-lg">
          {statusError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm text-muted">
          <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
            <tr>
              <th className="px-6 py-4">Provider</th>
              <th className="px-6 py-4">Payment Method</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td className="px-6 py-6 text-muted" colSpan={3}>
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-muted" colSpan={3}>
                  No payment methods available.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="table-row transition">
                  <td className="px-6 py-4 font-bold text-fg">{r.providerName}</td>
                  <td className="px-6 py-4">{r.paymentMethodName}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleActive(r)}
                      disabled={statusLoading === r.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                        r.isActive
                          ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/35 hover:bg-emerald-500/25"
                          : "bg-fg/5 text-fg-soft border border-border hover:bg-fg/10"
                      }`}
                      aria-pressed={r.isActive}
                      title={r.isActive ? "Set Inactive" : "Set Active"}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${r.isActive ? "bg-emerald-400" : "bg-gray-500"}`}
                        aria-hidden
                      />
                      {statusLoading === r.id ? "..." : r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}