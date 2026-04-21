"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SortDir = "asc" | "desc";
import {
  CreateClassModal,
  type ClassFormValues,
} from "@/components/admin/create-class-modal";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type ApiClass = {
  id: string;
  className: string;
  coachId: string;
  coachName?: string | null;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount?: number;
  remainingSlots?: number;
  branchName?: string | null;
  roomName?: string | null;
  description?: string | null;
  isActive: boolean;
};

type ApiCoach = {
  id: string;
  fullName?: string | null;
  name?: string | null;
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

/** PIK vs Puri (and other branches) — quick visual scan in the schedule table. */
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

export function ClassesView() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [selected, setSelected] = useState<ApiClass | null>(null);
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

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const loadClasses = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/classes?${params.toString()}`, { cache: "no-store" });
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
    if (Array.isArray(payload)) {
      setClasses(payload);
      setTotalItems(payload.length);
      setTotalPages(1);
    } else {
      const list = payload.items || payload.data || [];
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
    setLoading(false);
  }, [pageSize]);

  const loadCoaches = useCallback(async () => {
    const res = await fetch("/api/coaches?page=1&pageSize=100", { cache: "no-store" });
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

  useEffect(() => {
    void loadClasses(page);
    void loadCoaches();
  }, [loadClasses, loadCoaches, page]);

  const mappedRows = useMemo(() => {
    const rows = classes.map((c) => {
      const enrolled =
        c.bookedCount ?? Math.max(0, c.capacity - (c.remainingSlots ?? c.capacity));
      const time = c.startTime?.slice(0, 5) || "-";
      const trainer = c.coachName || c.coachId;
      const location = c.branchName || "-";
      return { ...c, enrolled, time, trainer, location };
    });
    if (!sortKey) return rows;
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
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      throw new Error(payload.message || "Create class gagal");
    }
    await loadClasses(page);
  }

  async function updateClass(values: ClassFormValues) {
    if (!selected) return;
    const enrolled =
      selected.bookedCount ??
      Math.max(0, selected.capacity - (selected.remainingSlots ?? selected.capacity));
    const body = {
      ...values,
      bookedCount: enrolled,
      remainingSlots: Math.max(0, values.capacity - enrolled),
    };
    const res = await fetch(`/api/classes/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      throw new Error(payload.message || "Update class gagal");
    }
    await loadClasses(page);
  }

  async function deleteClass(id: string) {
    const yes = window.confirm("Delete this class schedule?");
    if (!yes) return;
    const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      window.alert(payload.message || "Delete class gagal");
      return;
    }
    await loadClasses(page);
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="date"
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat"
            />
            <select className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat">
              <option>All Locations</option>
              <option>Puri Indah</option>
              <option>PIK Avenue</option>
            </select>
            </div>
            <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
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
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <i className="fas fa-plus" aria-hidden />
            Create New Class
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm text-gray-400">
          <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
            <tr>
              {(
                [
                  { label: "Time", key: "time" },
                  { label: "Class Name", key: "className" },
                  { label: "Trainer", key: "trainer" },
                  { label: "Location", key: "location" },
                  { label: "Capacity", key: "enrolled" },
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
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td className="px-6 py-6 text-gray-400" colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-6 py-6 text-red-400" colSpan={6}>
                  {error}
                </td>
              </tr>
            ) : mappedRows.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-gray-400" colSpan={6}>
                  Belum ada data class.
                </td>
              </tr>
            ) : (
              mappedRows.map((c) => {
                const pct = c.capacity > 0 ? (c.enrolled / c.capacity) * 100 : 0;
              return (
                <tr key={c.id} className="table-row transition">
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
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-white mx-1"
                      aria-label="Edit"
                      onClick={() => {
                        setSelected(c);
                        setEditOpen(true);
                      }}
                    >
                      <i className="fas fa-edit" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-400 mx-1"
                      aria-label="Delete"
                      onClick={() => void deleteClass(c.id)}
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
      <CreateClassModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        title="Edit Class"
        submitLabel="Save Changes"
        trainerOptions={trainers}
        initialValues={
          selected
            ? {
                className: selected.className,
                coachId: selected.coachId,
                classDate: selected.classDate,
                startTime: selected.startTime,
                endTime: selected.endTime,
                capacity: selected.capacity,
                branchName: selected.branchName || "",
                roomName: selected.roomName || "",
                description: selected.description || "",
              }
            : undefined
        }
        onSubmit={updateClass}
      />
    </>
  );
}
