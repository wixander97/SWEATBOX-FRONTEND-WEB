"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { downloadXlsx } from "@/lib/export";
import {
  DropInDetailModal,
  type MemberDropInPass,
} from "./drop-in-detail-modal";

type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  pageSize?: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function DropInView() {
  const [passes, setPasses] = useState<MemberDropInPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [detailMemberName, setDetailMemberName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const loadPasses = useCallback(
    async (targetPage: number, keyword: string) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      const trimmed = keyword.trim();
      if (trimmed) params.set("search", trimmed);
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/member-drop-in-passes?${params.toString()}`,
          { cache: "no-store" }
        );
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => [])) as
          | MemberDropInPass[]
          | PagedResponse<MemberDropInPass>;
        if (!res.ok) {
          const msg =
            typeof payload === "object" && !Array.isArray(payload)
              ? (payload as { message?: string }).message
              : "Failed to load drop-in passes";
          setError(msg || "Failed to load drop-in passes");
          setPasses([]);
          setTotalItems(0);
          setTotalPages(1);
          return;
        }
        const list: MemberDropInPass[] = Array.isArray(payload)
          ? payload
          : (payload.items ?? payload.data ?? []);
        const ti =
          !Array.isArray(payload)
            ? (payload.totalCount ?? payload.totalItems ?? payload.total ?? list.length)
            : list.length;
        const tp =
          !Array.isArray(payload)
            ? (payload.totalPages ?? payload.pageCount ?? Math.max(1, Math.ceil(ti / pageSize)))
            : 1;
        setPasses(list);
        setTotalItems(ti);
        setTotalPages(tp);
      } catch {
        setError("Failed to load drop-in passes");
        setPasses([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  // Debounce search input: commit search + reset page to 1 together so React 18
  // batches both into a single render (single load effect run, no double-fetch).
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadPasses(page, search);
  }, [loadPasses, page, search]);

  async function exportXlsx() {
    const val = (s?: string | null) => s || "—";
    const fmtDate = (iso?: string | null) => (iso ? formatDate(iso) : "—");

    const header = [
      "Member Name",
      "Member Code",
      "Email",
      "Phone",
      "Membership Status",
      "Remaining Credits",
      "Remaining PT Sessions",
      "Member Join Date",
      "Member Expiry Date",
      "Branch",
      "Total Visits",
      "Remaining Visits",
      "Purchased",
      "Expires",
      "Status",
    ];
    const rows = passes.map((p) => [
      val(p.member?.fullName),
      val(p.member?.memberCode),
      val(p.member?.email),
      val(p.member?.phoneNumber),
      val(p.member?.membershipStatus),
      String(p.member?.remainingCredits ?? 0),
      String(p.member?.remainingPtSessions ?? 0),
      fmtDate(p.member?.joinDate),
      fmtDate(p.member?.expiryDate),
      val(p.branch?.branchName),
      String(p.totalVisits),
      String(p.remainingVisits),
      fmtDate(p.purchasedAt),
      fmtDate(p.expiredAt),
      p.isActive ? "Active" : "Expired",
    ]);
    await downloadXlsx([header, ...rows], "drop-in-passes.xlsx");
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-display font-bold text-white">Drop In</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <i
              className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs ${searchInput ? "text-sweat" : "text-gray-500"}`}
              aria-hidden
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search member / code / branch..."
              className="w-full sm:w-64 bg-sidebar border border-border text-white text-sm rounded-lg pl-9 pr-9 py-2 focus:outline-none focus:border-sweat transition placeholder:text-gray-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                aria-label="Clear search"
                title="Clear search"
              >
                <i className="fas fa-times text-xs" aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void exportXlsx()}
            className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition flex items-center gap-2"
          >
            <i className="fas fa-file-export" aria-hidden />
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-gray-400">Loading...</div>
      ) : error ? (
        <div className="p-6 text-red-400">{error}</div>
      ) : passes.length === 0 ? (
        <div className="p-6 text-gray-400">
          No drop-in passes found{search ? ` for "${search}"` : ""}.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm text-gray-400">
              <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                <tr>
                  <th className="px-6 py-4">Member Name</th>
                  <th className="px-6 py-4">Member Code</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4 text-center">Total Visits</th>
                  <th className="px-6 py-4 text-center">Remaining</th>
                  <th className="px-6 py-4">Purchased</th>
                  <th className="px-6 py-4">Expires</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {passes.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition">
                    <td className="px-6 py-4 font-medium text-white">
                      {p.member?.fullName ?? "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-sweat">
                      {p.member?.memberCode ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {p.branch?.branchName ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-center text-white">
                      {p.totalVisits}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-sweat font-semibold">
                      {p.remainingVisits}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {formatDate(p.purchasedAt)}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {formatDate(p.expiredAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${p.isActive
                          ? "bg-green-500/10 text-green-400 border-green-500/30"
                          : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}
                      >
                        {p.isActive ? "Active" : "Expired"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailMemberId(p.memberId);
                          setDetailMemberName(p.member?.fullName ?? "");
                        }}
                        className="text-xs text-gray-400 hover:text-white border border-border px-2 py-1 rounded transition"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">Total {totalItems} item</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="bg-sidebar border border-border text-gray-400 px-3 py-1 rounded text-xs font-semibold hover:border-sweat hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-400 px-2 py-1">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="bg-sidebar border border-border text-gray-400 px-3 py-1 rounded text-xs font-semibold hover:border-sweat hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {detailMemberId && (
        <DropInDetailModal
          memberId={detailMemberId}
          memberName={detailMemberName}
          onClose={() => setDetailMemberId(null)}
        />
      )}
    </div>
  );
}
