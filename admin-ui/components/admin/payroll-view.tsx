"use client";

import { useMemo, useState } from "react";
import { useRole } from "@/contexts/role-context";

type PayrollRow = {
  coachName: string;
  totalClasses: number;
  totalMembers: number;
  estPayout: number;
  payoutLabel: string;
  status: string;
};

type SortDir = "asc" | "desc";
type PayrollSortKey = keyof PayrollRow;

const PAYROLL_DATA: PayrollRow[] = [
  { coachName: "Coach Raka", totalClasses: 24, totalMembers: 350, estPayout: 4500000, payoutLabel: "Rp 4.500.000", status: "Pending" },
  { coachName: "Coach Sarah", totalClasses: 30, totalMembers: 420, estPayout: 5200000, payoutLabel: "Rp 5.200.000", status: "Pending" },
];

export function PayrollView() {
  const { currentRole } = useRole();
  const [sortKey, setSortKey] = useState<PayrollSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: PayrollSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    if (!sortKey) return PAYROLL_DATA;
    return [...PAYROLL_DATA].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortKey, sortDir]);

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

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h4 className="font-bold text-lg">Payroll Periode: Februari 2024</h4>
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
                { label: "Est. Payout", key: "estPayout" },
              ] as { label: string; key: PayrollSortKey }[]
            ).map(({ label, key }) => (
              <th key={key} className="px-6 py-4">
                <button
                  type="button"
                  onClick={() => toggleSort(key)}
                  className="flex items-center gap-1.5 hover:text-white transition group"
                >
                  {label}
                  <span className="flex flex-col leading-none text-[10px]">
                    <i
                      className={`fas fa-caret-up ${sortKey === key && sortDir === "asc" ? "text-sweat" : "text-gray-600 group-hover:text-gray-400"}`}
                      aria-hidden
                    />
                    <i
                      className={`fas fa-caret-down ${sortKey === key && sortDir === "desc" ? "text-sweat" : "text-gray-600 group-hover:text-gray-400"}`}
                      aria-hidden
                    />
                  </span>
                </button>
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
          {rows.map((r) => (
            <tr key={r.coachName} className="table-row transition">
              <td className="px-6 py-4 font-bold text-white">{r.coachName}</td>
              <td className="px-6 py-4">{r.totalClasses}</td>
              <td className="px-6 py-4">{r.totalMembers}</td>
              <td className="px-6 py-4 font-mono text-sweat">{r.payoutLabel}</td>
              <td className="px-6 py-4 text-right">
                <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded text-xs font-bold border border-yellow-500/20">
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
