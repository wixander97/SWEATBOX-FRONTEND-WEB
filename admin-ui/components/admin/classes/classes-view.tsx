"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

type SortDir = "asc" | "desc";

type Branch = {
  id: string;
  branchName: string;
  isActive: boolean;
};

type StatusTab = "all" | "active" | "upcoming" | "completed" | "cancelled";

const STATUS_ENDPOINT: Record<StatusTab, string> = {
  all: "/api/v1/class-schedules/paged",
  active: "/api/v1/class-schedules/active",
  upcoming: "/api/v1/class-schedules/upcoming",
  completed: "/api/v1/class-schedules/completed",
  cancelled: "/api/v1/class-schedules/cancelled",
};

const ALLOWED_TABS: StatusTab[] = ["all", "active", "upcoming", "completed", "cancelled"];

import {
  CreateClassModal,
  type ClassFormValues,
} from "@/components/admin/classes/create-class-modal";
import { EditClassModal } from "@/components/admin/classes/edit-class-modal";
import { ClassDetailModal } from "@/components/admin/classes/class-detail-modal";
import type { ApiClass, ApiCoach, PagedResponse } from "@/components/admin/classes/classes.types";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { downloadXlsx } from "@/lib/export";


// Match the backend's accepted date format (ISO 8601 UTC), used elsewhere
// for class schedules (see create-class-modal.tsx toIsoDate).
function toIsoDateValue(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function classStatusLabel(c: ApiClass): "Completed" | "Cancelled" | "Active" | "Inactive" {
  if (c.isCancelled === true) return "Cancelled";
  if (c.isCompleted === true) return "Completed";
  if (c.isActive === true) return "Active";
  return "Inactive";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "Completed":
      return "bg-emerald-500/15 text-emerald-200 border border-emerald-500/35";
    case "Cancelled":
      return "bg-red-500/15 text-red-200 border border-red-500/35";
    case "Active":
      return "bg-sweat/15 text-sweat border border-sweat/35";
    default:
      return "bg-gray-800 text-gray-300 border border-border";
  }
}

function branchBadgeClass(branchName: string | null | undefined) {
  const n = (branchName ?? "").toLowerCase();
  if (n.includes("pik")) {
    return "bg-sky-500/15 text-sky-200 border border-sky-500/35";
  }
  if (n.includes("puri")) {
    return "bg-amber-500/15 text-amber-100 border border-amber-500/35";
  }
  return "bg-gray-800 text-gray-300 border border-border";
}

export function ClassesView({ initialStatus }: { initialStatus?: StatusTab }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editClass, setEditClass] = useState<ApiClass | null>(null);
  const [detailTarget, setDetailTarget] = useState<ApiClass | null>(null);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [trainers, setTrainers] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterDate, setFilterDate] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>(
    initialStatus && ALLOWED_TABS.includes(initialStatus) ? initialStatus : "all"
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<ApiClass | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const applyPayload = useCallback(
    (payload: ApiClass[] | PagedResponse<ApiClass>, fallbackList?: ApiClass[]) => {
      if (Array.isArray(payload)) {
        setClasses(payload);
        setTotalItems(payload.length);
        setTotalPages(1);
      } else {
        const list = fallbackList ?? payload.items ?? payload.data ?? [];
        const computedTotalItems =
          payload.totalCount ?? payload.totalItems ?? payload.total ?? list.length;
        const computedTotalPages =
          payload.totalPages ??
          payload.pageCount ??
          Math.max(1, Math.ceil(computedTotalItems / (payload.pageSize ?? pageSize)));
        setClasses(list);
        setTotalItems(computedTotalItems);
        setTotalPages(computedTotalPages);
      }
    },
    [pageSize]
  );

  const loadClasses = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError("");

      let url: string;
      if (statusTab !== "all") {
        // Status tab is the primary filter; ignore date/location filters.
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
        });
        url = `${API_BASE_URL}${STATUS_ENDPOINT[statusTab]}?${params.toString()}`;
      } else {
        const hasDate = filterDate.trim() !== "";
        const hasLocation = filterLocation.trim() !== "";
        // Both filters active: fetch by branch, then client-side date filter.
        if (hasLocation && hasDate) {
          url = `${API_BASE_URL}/api/v1/class-schedules/branch/${encodeURIComponent(filterLocation)}?page=1&pageSize=1000`;
        } else if (hasDate) {
          url = `${API_BASE_URL}/api/v1/class-schedules/date?date=${encodeURIComponent(toIsoDateValue(filterDate))}&page=${targetPage}&pageSize=${pageSize}`;
        } else if (hasLocation) {
          url = `${API_BASE_URL}/api/v1/class-schedules/branch/${encodeURIComponent(filterLocation)}?page=${targetPage}&pageSize=${pageSize}`;
        } else {
          const params = new URLSearchParams({
            page: String(targetPage),
            pageSize: String(pageSize),
          });
          url = `${API_BASE_URL}/api/v1/class-schedules/paged?${params.toString()}`;
        }
      }

      const res = await authFetch(url, { cache: "no-store" });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => [])) as
        | ApiClass[]
        | PagedResponse<ApiClass>;
      if (!res.ok) {
        const msg =
          typeof payload === "object" && !Array.isArray(payload)
            ? payload.message
            : "Gagal mengambil class schedule";
        setError(msg || "Gagal mengambil class schedule");
        setClasses([]);
        setTotalItems(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      // Combined filters (tab "all" only): client-side date filter + local pagination.
      if (statusTab === "all" && filterLocation.trim() !== "" && filterDate.trim() !== "") {
        const raw = Array.isArray(payload)
          ? payload
          : payload.items ?? payload.data ?? [];
        const filtered = raw.filter(
          (c) => (c.classDate ?? "").slice(0, 10) === filterDate
        );
        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const start = (targetPage - 1) * pageSize;
        const paged = filtered.slice(start, start + pageSize);
        setClasses(paged);
        setTotalItems(total);
        setTotalPages(pages);
      } else {
        applyPayload(payload);
      }
      setLoading(false);
    },
    [pageSize, statusTab, filterDate, filterLocation, applyPayload]
  );

  const loadCoaches = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches?page=1&pageSize=100`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => [])) as
      | ApiCoach[]
      | { data?: ApiCoach[]; items?: ApiCoach[] };
    const list = Array.isArray(payload)
      ? payload
      : payload.data || payload.items || [];
    if (!res.ok || !Array.isArray(list)) {
      setTrainers([]);
      return;
    }
    setTrainers(
      list.map((c) => ({
        id: c.id,
        name: c.fullName || c.name || c.id,
      }))
    );
  }, []);

  const loadBranches = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/v1/branches`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => [])) as Branch[] | { data?: Branch[]; items?: Branch[] };
    const list = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
    if (!res.ok || !Array.isArray(list)) {
      setBranches([]);
      return;
    }
    setBranches(list.filter((b) => b.isActive));
  }, []);

  useEffect(() => {
    void loadClasses(page);
    void loadCoaches();
    void loadBranches();
  }, [loadClasses, loadCoaches, loadBranches, page]);

  const mappedRows = useMemo(() => {
    const rows = classes.map((c) => {
      const enrolled =
        c.bookedCount ?? Math.max(0, c.capacity - (c.remainingSlots ?? c.capacity));
      const time = c.startTime?.slice(0, 5) || "-";
      const trainer = c.coachName || c.coachId;
      const location = c.branchName || "-";
      const status = classStatusLabel(c);
      return { ...c, enrolled, time, trainer, location, status };
    });
    if (!sortKey) {
      return [...rows].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      );
    }
    return [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? "";
      const bv = (b as Record<string, unknown>)[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [classes, sortKey, sortDir]);

  async function createClass(values: ClassFormValues) {
    const res = await authFetch(`${API_BASE_URL}/api/v1/class-schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      throw new Error(payload.message || "Create class gagal");
    }
    setPage(1);
    await loadClasses(1);
  }

  async function deleteClass(id: string) {
    setDeleteLoading(true);
    setDeleteError("");
    const res = await authFetch(`${API_BASE_URL}/api/v1/class-schedules/${id}`, { method: "DELETE" });
    if (redirectToLoginIfUnauthorized(res.status)) {
      setDeleteLoading(false);
      return;
    }
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    setDeleteLoading(false);
    if (!res.ok) {
      setDeleteError(payload.message || "Delete class gagal");
      return;
    }
    setDeleteId(null);
    await loadClasses(page);
  }

  async function cancelClass(cls: ApiClass) {
    setCancelLoading(true);
    setCancelError("");
    const res = await authFetch(`${API_BASE_URL}/api/v1/class-schedules/${cls.id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("string"),
    });
    if (redirectToLoginIfUnauthorized(res.status)) {
      setCancelLoading(false);
      return;
    }
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    setCancelLoading(false);
    if (!res.ok) {
      setCancelError(payload.message || "Cancel class gagal");
      return;
    }
    setCancelTarget(null);
    await loadClasses(page);
  }

  function classCsvRow(c: ApiClass): string[] {
    const enrolled =
      c.bookedCount ?? Math.max(0, c.capacity - (c.remainingSlots ?? c.capacity));
    return [
      c.classDate ? new Date(c.classDate).toLocaleDateString("id-ID") : "-",
      c.startTime?.slice(0, 5) || "-",
      c.className || "-",
      c.coachName || c.coachId || "-",
      c.branchName || "-",
      String(enrolled),
      String(c.capacity ?? 0),
      classStatusLabel(c),
    ];
  }

  async function exportXlsx() {
    const header = [
      "Class Date",
      "Time",
      "Class Name",
      "Trainer",
      "Location",
      "Enrolled",
      "Capacity",
      "Status",
    ];

    let source: ApiClass[];
    if (statusTab === "all") {
      const res = await authFetch(`${API_BASE_URL}/api/v1/class-schedules`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => [])) as
        | ApiClass[]
        | PagedResponse<ApiClass>;
      let all = Array.isArray(payload)
        ? payload
        : (payload.items ?? payload.data ?? []);
      const hasDate = filterDate.trim() !== "";
      const hasLocation = filterLocation.trim() !== "";
      if (hasDate) {
        all = all.filter((c) => (c.classDate ?? "").slice(0, 10) === filterDate);
      }
      if (hasLocation) {
        all = all.filter((c) => c.branchId === filterLocation);
      }
      source = all;
    } else {
      source = mappedRows;
    }

    const rows = source.map(classCsvRow);
    await downloadXlsx([header, ...rows], "classes.xlsx");
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 flex-wrap">
              {([
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "upcoming", label: "Upcoming" },
                { key: "completed", label: "Completed" },
                { key: "cancelled", label: "Cancelled" },
              ] as { key: StatusTab; label: string }[]).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setStatusTab(t.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${statusTab === t.key
                    ? "bg-sweat text-black border-sweat"
                    : "bg-sidebar border-border text-gray-400 hover:text-white"
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Date filter */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs uppercase font-bold text-gray-400">
                    <i className="fas fa-calendar" aria-hidden />
                    Date
                  </label>
                  {filterDate && statusTab === "all" && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterDate("");
                        setPage(1);
                      }}
                      title="Clear date"
                      className="text-gray-500 hover:text-white"
                      aria-label="Clear date"
                    >
                      <i className="fas fa-times" aria-hidden />
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setPage(1);
                  }}
                  disabled={statusTab !== "all"}
                  className={`[color-scheme:dark] bg-sidebar border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat disabled:opacity-50 ${filterDate && statusTab === "all" ? "border-sweat" : "border-border"
                    }`}
                />
              </div>

              {/* Location filter */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs uppercase font-bold text-gray-400">
                    <i className="fas fa-map-marker-alt" aria-hidden />
                    Location
                  </label>
                  {filterLocation && statusTab === "all" && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterLocation("");
                        setPage(1);
                      }}
                      title="Clear location"
                      className="text-gray-500 hover:text-white"
                      aria-label="Clear location"
                    >
                      <i className="fas fa-times" aria-hidden />
                    </button>
                  )}
                </div>
                <select
                  value={filterLocation}
                  onChange={(e) => {
                    setFilterLocation(e.target.value);
                    setPage(1);
                  }}
                  disabled={statusTab !== "all"}
                  className={`bg-sidebar border text-white px-4 py-2      
                  rounded-lg text-sm focus:outline-none focus:border-sweat disabled:opacity-50   
                  ${filterLocation && statusTab === "all" ? "border-sweat" : "border-border"
                    }`}
                >
                  <option value="">All Locations</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-white flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold uppercase tracking-wide text-gray-400">Lokasi</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" aria-hidden />
                PIK
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden />
                Puri
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-500" aria-hidden />
                Lainnya
              </span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
            <button
              type="button"
              onClick={() => void exportXlsx()}
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <i className="fas fa-file-export" aria-hidden />
              Export
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <i className="fas fa-plus" aria-hidden />
              Create New Class
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm text-gray-400">
            <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
              <tr>
                {(
                  [
                    { label: "Class Date", key: "classDate" },
                    { label: "Time", key: "time" },
                    { label: "Class Name", key: "className" },
                    { label: "Trainer", key: "trainer" },
                    { label: "Location", key: "location" },
                    { label: "Capacity", key: "enrolled" },
                    { label: "Status", key: "status" },
                  ] as { label: string; key: string }[]
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
                          className={`fas fa-caret-up ${sortKey === key && sortDir === "asc" ? "text-sweat" : "text-gray-400 group-hover:text-gray-200"}`}
                          aria-hidden
                        />
                        <i
                          className={`fas fa-caret-down ${sortKey === key && sortDir === "desc" ? "text-sweat" : "text-gray-400 group-hover:text-gray-200"}`}
                          aria-hidden
                        />
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className="px-6 py-6 text-gray-400" colSpan={8}>
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-6 py-6 text-red-400" colSpan={8}>
                    {error}
                  </td>
                </tr>
              ) : mappedRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-gray-400" colSpan={8}>
                    Belum ada data class.,
                  </td>
                </tr>
              ) : (
                mappedRows.map((c) => {
                  const pct = c.capacity > 0 ? (c.enrolled / c.capacity) * 100 : 0;
                  return (
                    <tr key={c.id} className="table-row transition">
                      <td className="px-6 py-4 text-gray-300">
                        {c.classDate ? new Date(c.classDate).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="px-6 py-4 font-bold text-white">{c.time}</td>
                      <td className="px-6 py-4 font-medium text-white">{c.className}</td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-gray-700 shrink-0" />
                          {c.trainer}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${branchBadgeClass(c.branchName)}`}
                        >
                          {c.location}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="bg-gray-700 h-2 rounded-full overflow-hidden w-24">
                          <div
                            className="bg-sweat h-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs mt-1 block">
                          {c.enrolled} / {c.capacity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${statusBadgeClass(c.status)}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          title="View Detail"
                          onClick={() => setDetailTarget(c)}
                          className="text-gray-400 hover:text-white mx-1"
                          aria-label="View Detail"
                        >
                          <i className="fas fa-eye" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="text-white hover:text-sweat mx-1"
                          aria-label="Edit"
                          onClick={() => {
                            setEditClass(c);
                            setEditOpen(true);
                          }}
                        >
                          <i className="fas fa-edit" aria-hidden />
                        </button>
                        {statusTab !== "cancelled" && !c.isCancelled && (
                          <button
                            type="button"
                            className="text-yellow-500 hover:text-yellow-400 mx-1"
                            aria-label="Cancel Class"
                            title="Cancel Class"
                            onClick={() => {
                              setCancelTarget(c);
                              setCancelError("");
                            }}
                          >
                            <i className="fas fa-ban" aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-400 mx-1"
                          aria-label="Delete"
                          onClick={() => {
                            setDeleteId(c.id);
                            setDeleteError("");
                          }}
                        >
                          <i className="fas fa-trash" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                }))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

      <CreateClassModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        trainerOptions={trainers}
        onSubmit={createClass}
      />
      <EditClassModal
        cls={editClass}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditClass(null);
        }}
        trainerOptions={trainers}
        onSuccess={() => void loadClasses(page)}
      />

      {detailTarget && (
        <ClassDetailModal
          cls={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-red-500/30 shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-2">Delete Class?</h3>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            {deleteError && (
              <p className="text-red-400 text-sm mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void deleteClass(deleteId)}
                disabled={deleteLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
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

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-yellow-500/30 shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-2">Cancel Class?</h3>
            <p className="text-gray-400 text-sm mb-4">This will cancel the class schedule.</p>
            {cancelError && (
              <p className="text-red-400 text-sm mb-3">{cancelError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void cancelClass(cancelTarget)}
                disabled={cancelLoading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                {cancelLoading ? "Cancelling..." : "Yes, cancel class"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelError("");
                }}
                className="flex-1 bg-sidebar border border-border text-white py-2 rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
