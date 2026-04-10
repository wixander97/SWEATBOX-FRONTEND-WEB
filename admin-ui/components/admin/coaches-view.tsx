"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type SortDir = "asc" | "desc";
type CoachSortKey = "fullName" | "specialization" | "rating" | "totalClasses" | "totalMembers";

type Coach = {
  id: string;
  fullName?: string | null;
  specialization?: string | null;
  profileImageUrl?: string | null;
  rating?: number;
  totalClasses?: number;
  totalMembers?: number;
  isActive?: boolean;
};

type CoachDetail = Coach & {
  email?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
};

type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  pageSize?: number;
  message?: string;
};

export function CoachesView() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(9);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selected, setSelected] = useState<CoachDetail | null>(null);
  const [sortKey, setSortKey] = useState<CoachSortKey>("fullName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: CoachSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const loadCoaches = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/coaches?${params.toString()}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => [])) as
      | Coach[]
      | PagedResponse<Coach>;
    if (!res.ok) {
      const msg =
        typeof payload === "object" && !Array.isArray(payload)
          ? payload.message
          : "Failed to fetch coaches";
      setError(msg || "Failed to fetch coaches");
      setCoaches([]);
      setTotalItems(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    if (Array.isArray(payload)) {
      setCoaches(payload);
      setTotalItems(payload.length);
      setTotalPages(1);
    } else {
      const list = payload.data || payload.items || [];
      const computedTotalItems =
        payload.totalCount ?? payload.totalItems ?? payload.total ?? list.length;
      const computedTotalPages =
        payload.totalPages ??
        payload.pageCount ??
        Math.max(1, Math.ceil(computedTotalItems / (payload.pageSize ?? pageSize)));
      setCoaches(list);
      setTotalItems(computedTotalItems);
      setTotalPages(computedTotalPages);
    }
    setLoading(false);
  }, [pageSize]);

  useEffect(() => {
    void loadCoaches(page);
  }, [loadCoaches, page]);

  const sortedCoaches = useMemo(() => {
    return [...coaches].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [coaches, sortKey, sortDir]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailError("");
    setSelected(null);
    const res = await fetch(`/api/coaches/${id}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => ({}))) as CoachDetail & {
      data?: CoachDetail;
      message?: string;
    };
    if (!res.ok) {
      setDetailError(payload.message || "Failed to fetch detail");
      setDetailLoading(false);
      return;
    }
    setSelected(payload.data || payload);
    setDetailLoading(false);
  }

  return (
    <>
      {loading ? (
        <div className="text-gray-400">Loading coaches...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : coaches.length === 0 ? (
        <div className="text-gray-400">No coaches found.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 uppercase font-bold mr-1">Sort by:</span>
            {(
              [
                { label: "Name", key: "fullName" },
                { label: "Specialization", key: "specialization" },
                { label: "Rating", key: "rating" },
                { label: "Classes", key: "totalClasses" },
                { label: "Members", key: "totalMembers" },
              ] as { label: string; key: CoachSortKey }[]
            ).map(({ label, key }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border transition ${
                  sortKey === key
                    ? "bg-sweat/10 border-sweat text-sweat"
                    : "bg-sidebar border-border text-gray-400 hover:text-white hover:border-gray-500"
                }`}
              >
                {label}
                {sortKey === key && (
                  <i
                    className={`fas fa-caret-${sortDir === "asc" ? "up" : "down"} text-[10px]`}
                    aria-hidden
                  />
                )}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {sortedCoaches.map((coach) => (
              <div
                key={coach.id}
                className="bg-card rounded-xl border border-border p-6 text-center group hover:border-sweat transition"
              >
                <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 overflow-hidden border-2 border-transparent group-hover:border-sweat transition">
                  <Image
                    src={
                      coach.profileImageUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        coach.fullName || "Coach"
                      )}&background=random`
                    }
                    alt=""
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <h3 className="font-bold text-xl text-white">
                  {coach.fullName || "-"}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {coach.specialization || "No specialization"}
                </p>
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-left">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Classes</p>
                    <p className="font-bold text-lg text-white">
                      {coach.totalClasses ?? 0}{" "}
                      <span className="text-xs font-normal">/mo</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Rating</p>
                    <p className="font-bold text-lg text-sweat">
                      {coach.rating ?? 0}{" "}
                      <i className="fas fa-star text-xs" aria-hidden />
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void openDetail(coach.id)}
                  className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm border border-border transition"
                >
                  View Detail
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 px-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-400">
              Page {page} of {Math.max(1, totalPages)} • {totalItems} data
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="bg-sidebar border border-border text-white px-3 py-1.5 rounded text-xs disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="bg-sidebar border border-border text-white px-3 py-1.5 rounded text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {(detailLoading || detailError || selected) && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              setSelected(null);
              setDetailError("");
              setDetailLoading(false);
            }
          }}
        >
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase">
                Coach Detail
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setDetailError("");
                  setDetailLoading(false);
                }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            {detailLoading ? (
              <p className="text-gray-400">Loading detail...</p>
            ) : detailError ? (
              <p className="text-red-400">{detailError}</p>
            ) : selected ? (
              <div className="space-y-2 text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">Name:</span>{" "}
                  {selected.fullName || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Email:</span>{" "}
                  {selected.email || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Phone:</span>{" "}
                  {selected.phoneNumber || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Specialization:</span>{" "}
                  {selected.specialization || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Total Members:</span>{" "}
                  {selected.totalMembers ?? 0}
                </p>
                <p>
                  <span className="text-gray-500">Bio:</span>{" "}
                  {selected.bio || "-"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
