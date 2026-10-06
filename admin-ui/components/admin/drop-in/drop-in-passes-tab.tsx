"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessageOf } from "@/lib/api/http";
import { listBranches, branchLabel, type Branch } from "@/lib/api/branches";
import {
  dropInPassTypeLabel,
  listDropInPasses,
  type DropInPassRow,
} from "@/lib/api/drop-in";
import { downloadXlsx } from "@/lib/export";
import { jakartaDate, jakartaDateRange, jakartaDateTime } from "@/lib/jakarta-time";
import { DropInDetailModal } from "./drop-in-detail-modal";
import { LegacyDropInPassesList } from "./legacy-drop-in-passes";

const PAGE_SIZE = 20;
const COLUMNS = 9;

const PASS_TYPE_FILTERS = [
  { value: "", label: "All types" },
  { value: "DayPass", label: "One Day Pass" },
  { value: "SingleVisit", label: "Single Visit" },
  { value: "MultiVisit", label: "Drop-In Pass (legacy)" },
];

function statusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case "active":
      return "success";
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}

function usageText(p: DropInPassRow): string {
  if (p.isUnlimitedVisits) {
    return `${p.usedCount} ${p.usedCount === 1 ? "class" : "classes"} attended · Unlimited`;
  }
  return `${p.usedCount}/${p.totalVisits}`;
}

export function DropInPassesTab() {
  const toast = useToast();
  const [rows, setRows] = useState<DropInPassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The backend predates `/api/v1/drop-in/passes`: show the old list. */
  const [legacy, setLegacy] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [passType, setPassType] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<{ memberId: string; memberName: string } | null>(null);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  // Debounced search; committing search and page together keeps it to one load.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      const result = await listDropInPasses({
        page,
        pageSize: PAGE_SIZE,
        search,
        branchId,
        passType,
      });
      setRows(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLegacy(true);
        return;
      }
      setError(errorMessageOf(err, "Failed to load drop-in passes"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, branchId, passType]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportXlsx() {
    if (exporting) return;
    setExporting(true);
    try {
      // Every row matching the current filters, not just the visible page.
      const all: DropInPassRow[] = [];
      for (let p = 1; p <= 50; p++) {
        const result = await listDropInPasses({
          page: p,
          pageSize: 200,
          search,
          branchId,
          passType,
        });
        all.push(...result.items);
        if (p >= result.totalPages || result.items.length === 0) break;
      }

      const header = [
        "Member Name",
        "Member Code",
        "Branch",
        "Type",
        "Valid From",
        "Valid Until",
        "Classes Attended",
        "Total Visits",
        "Remaining Visits",
        "Reserved",
        "Status",
        "Purchased At",
      ];
      const data = all.map((p) => [
        p.memberName || "—",
        p.memberCode || "—",
        p.branchName || "—",
        dropInPassTypeLabel(p.passType, p.passName),
        jakartaDate(p.validFrom ?? p.purchasedAt),
        jakartaDate(p.expiredAt),
        String(p.usedCount),
        p.isUnlimitedVisits ? "Unlimited" : String(p.totalVisits),
        p.isUnlimitedVisits ? "Unlimited" : String(p.remainingVisits),
        String(p.reservedCount),
        p.status,
        jakartaDateTime(p.purchasedAt),
      ]);
      await downloadXlsx([header, ...data], "drop-in-passes.xlsx");
    } catch (err) {
      toast.error("Export failed", errorMessageOf(err, "Could not export drop-in passes"));
    } finally {
      setExporting(false);
    }
  }

  if (legacy) return <LegacyDropInPassesList />;

  const selectClass =
    "bg-sidebar border border-border text-fg text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sweat";

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <i
              className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs ${searchInput ? "text-accent-ink" : "text-muted"}`}
              aria-hidden
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search member / code..."
              aria-label="Search drop-in passes"
              className="w-full sm:w-64 bg-sidebar border border-border text-fg text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-sweat transition placeholder:text-muted"
            />
          </div>
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by branch"
            className={selectClass}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchLabel(b)}
              </option>
            ))}
          </select>
          <select
            value={passType}
            onChange={(e) => {
              setPassType(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by type"
            className={selectClass}
          >
            {PASS_TYPE_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void exportXlsx()}
          disabled={exporting}
          data-help-target="dropin-export"
          className="bg-sidebar border border-border text-fg px-4 py-2 rounded-lg text-sm hover:bg-fg/5 transition flex items-center gap-2 disabled:opacity-60 self-start"
        >
          <i className={`fas ${exporting ? "fa-circle-notch fa-spin" : "fa-file-export"}`} aria-hidden />
          Export
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Valid Day(s)</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3 text-center">Reserved</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Purchased</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <LoadingState colSpan={COLUMNS} />
              ) : error ? (
                <ErrorState
                  colSpan={COLUMNS}
                  message={error}
                  onRetry={() => {
                    setLoading(true);
                    void load();
                  }}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  colSpan={COLUMNS}
                  icon="fa-ticket"
                  title="No drop-in passes found"
                  description={search ? `Nothing matches "${search}".` : undefined}
                />
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-fg/5 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{p.memberName || "—"}</p>
                      <p className="font-mono text-[11px] text-accent-ink">{p.memberCode || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-fg">{p.branchName || "—"}</td>
                    <td className="px-4 py-3 text-fg">{dropInPassTypeLabel(p.passType, p.passName)}</td>
                    <td className="px-4 py-3 text-fg whitespace-nowrap">
                      {jakartaDateRange(p.validFrom ?? p.purchasedAt, p.expiredAt)}
                    </td>
                    <td className="px-4 py-3 text-fg whitespace-nowrap">{usageText(p)}</td>
                    <td className="px-4 py-3 text-center text-fg">{p.reservedCount}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(p.status)}>{p.status || "—"}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{jakartaDateTime(p.purchasedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetail({ memberId: p.memberId, memberName: p.memberName })}
                        className="text-xs text-muted hover:text-fg border border-border px-2 py-1 rounded transition"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          loading={loading}
          onChange={(next) => {
            setLoading(true);
            setPage(next);
          }}
          label="passes"
        />
      </div>

      {detail ? (
        <DropInDetailModal
          memberId={detail.memberId}
          memberName={detail.memberName}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
