"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { useRole } from "@/contexts/role-context";
// TODO: Re-enable create payment feature
// import { CreatePaymentModal } from "./create-payment-modal";
import { PaymentDetailModal } from "./payment-detail-modal";

export type Payment = {
  id: string;
  userId: string;
  membershipPlanId: string;
  membershipPlanName: string | null;
  invoiceNo: string;
  amount: number;
  discount: number;
  tax: number;
  finalAmount: number;
  paymentMethod: number;
  paymentStatus: number;
  paymentProvider: number;
  providerTransactionId: string | null;
  providerOrderId: string | null;
  snapToken: string | null;
  redirectUrl: string | null;
  expiryAt: string;
  paidAt: string | null;
  notes: string | null;
  created: string;
  lastModified: string | null;
};

type PaymentSummary = {
  totalRevenue?: number;
  totalAmount?: number;
  paidCount?: number;
  pendingCount?: number;
  failedCount?: number;
};

type StatusTab = "all" | "paid" | "pending" | "failed";
type SortKey = "invoiceNo" | "finalAmount" | "paymentStatus" | "created";
type SortDir = "asc" | "desc";

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function statusBadge(status: number) {
  if (status === 1) return { label: "Paid", class: "bg-green-500/10 text-green-500 border-green-500/20" };
  if (status === 0) return { label: "Pending", class: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
  return { label: "Failed", class: "bg-red-500/10 text-red-500 border-red-500/20" };
}

export function PaymentsView() {
  const { currentRole } = useRole();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // TODO: Re-enable create payment feature
  // const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadPayments = useCallback(async (tab: StatusTab) => {
    setLoading(true);
    setError("");
    const statusMap: Record<StatusTab, string> = {
      all: "",
      paid: "/paid",
      pending: "/pending",
      failed: "/failed",
    };
    const params = statusMap[tab];
    const res = await authFetch(`${API_BASE_URL}/api/v1/payments${params}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const data = (await res.json().catch(() => [])) as Payment[] | { items?: Payment[]; data?: Payment[] };
    if (!res.ok) {
      setError("Failed to load payments");
      setPayments([]);
      setLoading(false);
      return;
    }
    const list: Payment[] = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
    setPayments(list);
    setLoading(false);
  }, []);

  const loadSummary = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/v1/payments/summary`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data) setSummary(data as PaymentSummary);
    }
  }, []);

  useEffect(() => {
    void loadPayments(activeTab);
  }, [loadPayments, activeTab]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = useMemo(() => {
    return [...payments].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [payments, sortKey, sortDir]);

  async function handleDelete(id: string) {
    setActionLoading(true);
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
    setActionLoading(false);
    setDeleteId(null);
    if (res.ok) {
      void loadPayments(activeTab);
      void loadSummary();
    }
  }

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "paid", label: "Paid" },
    { key: "pending", label: "Pending" },
    { key: "failed", label: "Failed" },
  ];

  const totalRevenue = summary?.totalRevenue ?? summary?.totalAmount;

  return (
    <>
      {currentRole === "superadmin" && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          {totalRevenue !== undefined && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-sweat">{formatRupiah(totalRevenue)}</p>
            </div>
          )}
          {summary.paidCount !== undefined && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Paid</p>
              <p className="text-2xl font-bold text-green-400">{summary.paidCount}</p>
            </div>
          )}
          {summary.pendingCount !== undefined && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-400">{summary.pendingCount}</p>
            </div>
          )}
          {summary.failedCount !== undefined && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-400">{summary.failedCount}</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${activeTab === t.key
                  ? "bg-sweat text-black border-sweat"
                  : "bg-sidebar border-border text-gray-400 hover:text-white"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* TODO: Re-enable create payment feature
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-sweat text-black rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
          >
            Create Payment
          </button>
          */}
        </div>

        {loading ? (
          <div className="p-6 text-gray-400">Loading payments...</div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-gray-400">No payments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm text-gray-400">
              <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                <tr>
                  {(
                    [
                      { label: "Invoice", key: "invoiceNo" },
                      { label: "Plan", key: null },
                      { label: "Amount", key: null },
                      { label: "Final", key: "finalAmount" },
                      { label: "Status", key: "paymentStatus" },
                      { label: "Created", key: "created" },
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
                {sorted.map((p) => {
                  const badge = statusBadge(p.paymentStatus);
                  return (
                    <tr key={p.id} className="table-row transition">
                      <td className="px-6 py-4 font-mono text-xs text-sweat">
                        {p.invoiceNo}
                      </td>
                      <td className="px-6 py-4 font-medium text-white">
                        {p.membershipPlanName ?? "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-white">
                        {formatRupiah(p.amount)}
                      </td>
                      <td className="px-6 py-4 font-mono text-green-400">
                        {formatRupiah(p.finalAmount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(p.created).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelected(p)}
                            className="text-xs text-gray-400 hover:text-white border border-border px-2 py-1 rounded transition"
                          >
                            Detail
                          </button>
                          {currentRole === "superadmin" && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(p.id)}
                              className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded transition"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <PaymentDetailModal
          payment={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-red-500/30 shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-2">Delete Payment?</h3>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleDelete(deleteId)}
                disabled={actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Delete"}
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

      {/* TODO: Re-enable create payment feature
      {createModalOpen && (
        <CreatePaymentModal
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            void loadPayments(activeTab);
            void loadSummary();
          }}
        />
      )}
      */}
    </>
  );
}
