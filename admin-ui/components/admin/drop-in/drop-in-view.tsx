"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
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

  const loadPasses = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
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

  useEffect(() => {
    void loadPasses(page);
  }, [loadPasses, page]);

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-bold text-white">Drop In</h2>
      </div>

      {loading ? (
        <div className="p-6 text-gray-400">Loading...</div>
      ) : error ? (
        <div className="p-6 text-red-400">{error}</div>
      ) : passes.length === 0 ? (
        <div className="p-6 text-gray-400">No drop-in passes found.</div>
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
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                          p.isActive
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
