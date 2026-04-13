"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { useRole } from "@/contexts/role-context";

type Payment = {
  id: string;
  memberName?: string | null;
  fullName?: string | null;
  memberCode?: string | null;
  membershipType?: string | null;
  amount?: number;
  discount?: number;
  tax?: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  paymentProvider?: string | null;
  notes?: string | null;
  createdAt?: string | null;
};

type PaymentSummary = {
  totalRevenue?: number;
  totalAmount?: number;
  paidCount?: number;
  pendingCount?: number;
  failedCount?: number;
};

type StatusTab = "all" | "paid" | "pending" | "failed";
type SortKey = "memberName" | "amount" | "paymentStatus" | "createdAt";
type SortDir = "asc" | "desc";

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "paid") return "bg-green-500/10 text-green-500 border-green-500/20";
  if (s === "pending") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  return "bg-red-500/10 text-red-500 border-red-500/20";
}

export function PaymentsView() {
  const { currentRole } = useRole();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPayments = useCallback(async (tab: StatusTab) => {
    setLoading(true);
    setError("");
    const params = tab !== "all" ? `?status=${tab}` : "";
    const res = await fetch(`/api/payments${params}`, { cache: "no-store" });
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
    const res = await fetch("/api/payments/summary", { cache: "no-store" });
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
      {currentRole === "owner" && summary && (
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  activeTab === t.key
                    ? "bg-sweat text-black border-sweat"
                    : "bg-sidebar border-border text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
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
                      { label: "Member", key: "memberName" },
                      { label: "Amount", key: "amount" },
                      { label: "Method", key: null },
                      { label: "Status", key: "paymentStatus" },
                      { label: "Date", key: "createdAt" },
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
                  const status = p.paymentStatus ?? p.status ?? "—";
                  return (
                    <tr key={p.id} className="table-row transition">
                      <td className="px-6 py-4 font-medium text-white">
                        {p.memberName ?? p.fullName ?? "—"}
                        {p.memberCode && (
                          <span className="block text-xs text-gray-500">{p.memberCode}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-white">
                        {p.amount != null ? formatRupiah(p.amount) : "—"}
                      </td>
                      <td className="px-6 py-4">{p.paymentMethod ?? "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${statusBadge(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleDateString("id-ID")
                          : "—"}
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
                          {currentRole === "owner" && (
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
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => { if (e.currentTarget === e.target) setSelected(null); }}
        >
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase">Payment Detail</h3>
              <button type="button" onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              {[
                ["Member", selected.memberName ?? selected.fullName],
                ["Member Code", selected.memberCode],
                ["Membership Type", selected.membershipType],
                ["Amount", selected.amount != null ? formatRupiah(selected.amount) : null],
                ["Discount", selected.discount != null ? formatRupiah(selected.discount) : null],
                ["Tax", selected.tax != null ? formatRupiah(selected.tax) : null],
                ["Method", selected.paymentMethod],
                ["Provider", selected.paymentProvider],
                ["Status", selected.paymentStatus ?? selected.status],
                ["Notes", selected.notes],
                ["Date", selected.createdAt ? new Date(selected.createdAt).toLocaleString("id-ID") : null],
              ].map(([label, val]) =>
                val != null ? (
                  <p key={String(label)}>
                    <span className="text-gray-500">{label}:</span> {String(val)}
                  </p>
                ) : null
              )}
            </div>
          </div>
        </div>
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
    </>
  );
}
