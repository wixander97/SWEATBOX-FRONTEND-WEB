"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRole } from "@/contexts/role-context";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type PayrollRow = {
  coachId?: string;
  coachName?: string;
  fullName?: string;
  totalClasses?: number;
  totalMembers?: number;
  totalPtSessions?: number;
  payrollType?: string;
  payrollRate?: number;
  estimatedPayout?: number;
  estPayout?: number;
  status?: string;
};

type SortDir = "asc" | "desc";
type PayrollSortKey = "coachName" | "totalClasses" | "totalMembers" | "estimatedPayout" | "status";

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function PayrollView() {
  const { currentRole } = useRole();
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<PayrollSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: PayrollSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/coaches?page=1&pageSize=100", { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = await res.json().catch(() => ({})) as {
      items?: PayrollRow[];
      data?: PayrollRow[];
    } | PayrollRow[];
    if (!res.ok) {
      setError("Failed to load payroll data");
      setLoading(false);
      return;
    }
    const coaches: PayrollRow[] = Array.isArray(payload)
      ? payload
      : (payload.items ?? payload.data ?? []);

    const payrollRows: PayrollRow[] = coaches.map((c) => ({
      coachId: (c as { id?: string }).id,
      coachName: c.coachName ?? c.fullName ?? "—",
      totalClasses: c.totalClasses ?? 0,
      totalMembers: c.totalMembers ?? 0,
      totalPtSessions: c.totalPtSessions ?? 0,
      payrollType: c.payrollType ?? "—",
      payrollRate: c.payrollRate ?? 0,
      estimatedPayout: c.estimatedPayout ?? c.estPayout,
      status: c.status ?? "Pending",
    }));
    setRows(payrollRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPayroll();
  }, [loadPayroll]);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  if (currentRole !== "owner") {
    return (
      <div className="bg-card rounded-xl border border-dashed border-red-500 p-6 sm:p-12 text-center">
        <i className="fas fa-lock text-red-500 text-5xl mb-4" aria-hidden />
        <h3 className="text-2xl font-bold text-white mb-2">Access Denied</h3>
        <p className="text-gray-400">
          Anda tidak memiliki izin untuk melihat halaman Keuangan &amp; Payroll.
        </p>
      </div>
    );
  }

  if (loading) return <div className="text-gray-400">Loading payroll data...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h4 className="font-bold text-lg">Coach Payroll Overview</h4>
        <button
          type="button"
          className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
        >
          <i className="fas fa-download mr-2" aria-hidden />
          Export Report
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm text-gray-400">
          <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
            <tr>
              {(
                [
                  { label: "Coach Name", key: "coachName" },
                  { label: "Total Classes", key: "totalClasses" },
                  { label: "Total Members", key: "totalMembers" },
                  { label: "Payroll Type", key: null },
                  { label: "Rate", key: null },
                ] as { label: string; key: PayrollSortKey | null }[]
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
              <th className="px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className="flex items-center gap-1.5 hover:text-white transition group ml-auto"
                >
                  Status
                  <span className="flex flex-col leading-none text-[10px]">
                    <i className={`fas fa-caret-up ${sortKey === "status" && sortDir === "asc" ? "text-sweat" : "text-gray-600 group-hover:text-gray-400"}`} aria-hidden />
                    <i className={`fas fa-caret-down ${sortKey === "status" && sortDir === "desc" ? "text-sweat" : "text-gray-600 group-hover:text-gray-400"}`} aria-hidden />
                  </span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-gray-500">No data available</td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr key={r.coachId ?? i} className="table-row transition">
                  <td className="px-6 py-4 font-bold text-white">{r.coachName}</td>
                  <td className="px-6 py-4">{r.totalClasses ?? 0}</td>
                  <td className="px-6 py-4">{r.totalMembers ?? 0}</td>
                  <td className="px-6 py-4 capitalize">{r.payrollType ?? "—"}</td>
                  <td className="px-6 py-4 font-mono">
                    {r.estimatedPayout != null
                      ? formatRupiah(r.estimatedPayout)
                      : r.payrollRate != null
                      ? formatRupiah(r.payrollRate)
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded text-xs font-bold border border-yellow-500/20">
                      {r.status ?? "Pending"}
                    </span>
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
