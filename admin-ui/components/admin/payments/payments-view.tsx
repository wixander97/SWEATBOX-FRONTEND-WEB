"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { downloadXlsx } from "@/lib/export";
import { useRole } from "@/contexts/role-context";
// TODO: Re-enable create payment feature
// import { CreatePaymentModal } from "./create-payment-modal";
import { PaymentDetailModal } from "./payment-detail-modal";
import { paymentStatusMeta } from "./payment-status";

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
  return amount.toLocaleString("id-ID");
}

function statusBadge(status: number) {
  return paymentStatusMeta(status);
}

const ALLOWED_TABS: StatusTab[] = ["all", "paid", "pending", "failed"];

export function PaymentsView({ initialStatus }: { initialStatus?: StatusTab }) {
  const { currentRole } = useRole();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>(
    initialStatus && ALLOWED_TABS.includes(initialStatus) ? initialStatus : "all"
  );
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

  const PAYMENT_METHOD_LABELS: Record<number, string> = {
    0: "Cash",
    1: "Bank Transfer",
    2: "QRIS",
    3: "Credit Card",
    4: "Debit Card",
    5: "E-Wallet",
    6: "Virtual Account",
  };

  async function exportXlsx() {
    const statusLabel = (s: number) => paymentStatusMeta(s).label;
    const methodLabel = (m: number) => PAYMENT_METHOD_LABELS[m] ?? String(m);
    const providerLabel = (p: number) => (p === 0 ? "Offline" : "Midtrans");
    const val = (s?: string | null) => s || "—";
    const num = (n?: number | null) =>
      n != null ? n.toLocaleString("id-ID") : "—";
    const fmtDateTime = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleString("id-ID") : "—";

    const header = [
      "Invoice No",
      "Membership Plan",
      "Amount",
      "Discount",
      "Tax",
      "Final Amount",
      "Payment Method",
      "Payment Status",
      "Payment Provider",
      "Expiry At",
      "Paid At",
      "Notes",
      "Created",
      "Last Modified",
    ];
    const rows = sorted.map((p) => [
      val(p.invoiceNo),
      val(p.membershipPlanName),
      num(p.amount),
      num(p.discount),
      num(p.tax),
      num(p.finalAmount),
      methodLabel(p.paymentMethod),
      statusLabel(p.paymentStatus),
      providerLabel(p.paymentProvider),
      fmtDateTime(p.expiryAt),
      fmtDateTime(p.paidAt),
      val(p.notes),
      fmtDateTime(p.created),
      fmtDateTime(p.lastModified),
    ]);
    await downloadXlsx([header, ...rows], "payments.xlsx");
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
          <button
            type="button"
            onClick={() => void exportXlsx()}
            className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition flex items-center gap-2"
          >
            <i className="fas fa-file-export" aria-hidden />
            Export
          </button>
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
                            className="text-gray-400 hover:text-white mx-1"
                            aria-label="Detail"
                            title="Detail"
                          >
                            <i className="fas fa-eye" aria-hidden />
                          </button>
                          {currentRole === "superadmin" && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(p.id)}
                              className="text-red-500 hover:text-red-400 mx-1"
                              aria-label="Delete"
                              title="Delete"
                            >
                              <i className="fas fa-trash" aria-hidden />
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
