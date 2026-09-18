"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRole } from "@/contexts/role-context";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { downloadXlsx } from "@/lib/export";
import { useToast } from "@/components/ui/toast";

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
  return amount.toLocaleString("id-ID");
}

export function PayrollView() {
  // Payroll figures are finance data; the API guards the equivalent summary
  // behind SuperAdmin, so the page follows the same rule.
  const { can } = useRole();
  const toast = useToast();
  const canSeeFinance = can("finance.read");
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<PayrollSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exporting, setExporting] = useState(false);

  function toggleSort(key: PayrollSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/coaches?page=1&pageSize=100`, { cache: "no-store" });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = await res.json().catch(() => ({})) as {
        items?: PayrollRow[];
        data?: PayrollRow[];
        message?: string;
      } | PayrollRow[];
      if (!res.ok) {
        const msg = !Array.isArray(payload) ? payload.message : undefined;
        setError(msg || "Failed to load payroll data");
        return;
      }
      const coaches: PayrollRow[] = Array.isArray(payload)
        ? payload
        : (payload.items ?? payload.data ?? []);

      const payrollRows: PayrollRow[] = coaches.map((c) => ({
        coachId: (c as { id?: string }).id,
        coachName: c.coachName || c.fullName || "—",
        totalClasses: c.totalClasses ?? 0,
        totalMembers: c.totalMembers ?? 0,
        totalPtSessions: c.totalPtSessions ?? 0,
        // A coach without payroll configured comes back with an empty string,
        // which rendered as a blank cell.
        payrollType: c.payrollType?.trim() || undefined,
        payrollRate: c.payrollRate ?? undefined,
        estimatedPayout: c.estimatedPayout ?? c.estPayout,
        status: c.status || "Pending",
      }));
      setRows(payrollRows);
    } catch {
      // authFetch rejects on a network failure; without this the page stayed
      // on "Loading payroll data..." forever.
      setError("Failed to load payroll data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * There is no payroll export endpoint, so the report is built from the rows
   * already loaded, in the order currently shown — the same client-side
   * approach every other export in the portal uses.
   */
  async function exportReport() {
    if (exporting) return;
    if (sorted.length === 0) {
      toast.info("Nothing to export", "There is no payroll data to include in the report.");
      return;
    }
    setExporting(true);
    try {
      const header = [
        "Coach Name",
        "Total Classes",
        "Total Members",
        "Total PT Sessions",
        "Payroll Type",
        "Rate",
        "Est. Payout",
        "Status",
      ];
      const data = sorted.map((r) => [
        r.coachName ?? "—",
        r.totalClasses ?? 0,
        r.totalMembers ?? 0,
        r.totalPtSessions ?? 0,
        r.payrollType ?? "—",
        r.payrollRate ?? "—",
        r.estimatedPayout ?? "—",
        r.status ?? "Pending",
      ]);
      const date = new Date().toISOString().slice(0, 10);
      const ok = await downloadXlsx([header, ...data], `coaches-payroll-report-${date}.xlsx`);
      if (ok) toast.success("Payroll report exported.");
      else toast.error("Could not export the payroll report", "The file could not be generated. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!canSeeFinance) return;
    void loadPayroll();
  }, [loadPayroll, canSeeFinance]);

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

  if (!canSeeFinance) {
    return (
      <div className="bg-card rounded-xl border border-dashed border-red-500 p-6 sm:p-12 text-center">
        <i className="fas fa-lock text-danger text-5xl mb-4" aria-hidden />
        <h3 className="text-2xl font-bold text-fg mb-2">Access Denied</h3>
        <p className="text-muted">
          Your role does not have permission to view Finance &amp; Payroll.
        </p>
      </div>
    );
  }

  if (loading) return <div className="text-muted">Loading payroll data...</div>;
  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
        <p className="text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={() => void loadPayroll()}
          className="text-xs text-fg bg-fg/5 hover:bg-fg/10 border border-border px-4 py-2 rounded-lg"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h4 className="font-bold text-lg">Coach Payroll Overview</h4>
        <button
          type="button"
          onClick={() => void exportReport()}
          disabled={exporting}
          aria-busy={exporting}
          className="bg-sidebar border border-border text-fg px-4 py-2 rounded-lg text-sm hover:bg-fg/5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className={`fas ${exporting ? "fa-circle-notch fa-spin" : "fa-download"} mr-2`} aria-hidden />
          {exporting ? "Exporting…" : "Export Report"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm text-muted">
          <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
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
                      className="flex items-center gap-1.5 hover:text-fg transition group"
                    >
                      {label}
                      <span className="flex flex-col leading-none text-[10px]">
                        <i className={`fas fa-caret-up ${sortKey === key && sortDir === "asc" ? "text-accent-ink" : "text-muted group-hover:text-muted"}`} aria-hidden />
                        <i className={`fas fa-caret-down ${sortKey === key && sortDir === "desc" ? "text-accent-ink" : "text-muted group-hover:text-muted"}`} aria-hidden />
                      </span>
                    </button>
                  ) : label}
                </th>
              ))}
              <th className="px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className="flex items-center gap-1.5 hover:text-fg transition group ml-auto"
                >
                  Status
                  <span className="flex flex-col leading-none text-[10px]">
                    <i className={`fas fa-caret-up ${sortKey === "status" && sortDir === "asc" ? "text-accent-ink" : "text-muted group-hover:text-muted"}`} aria-hidden />
                    <i className={`fas fa-caret-down ${sortKey === "status" && sortDir === "desc" ? "text-accent-ink" : "text-muted group-hover:text-muted"}`} aria-hidden />
                  </span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-muted">No data available</td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr key={r.coachId ?? i} className="table-row transition">
                  <td className="px-6 py-4 font-bold text-fg">{r.coachName}</td>
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
                    <span className="bg-yellow-500/10 text-warning px-3 py-1 rounded text-xs font-bold border border-yellow-500/20">
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
