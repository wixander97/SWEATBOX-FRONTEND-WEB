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
  branchName?: string | null;
  payrollType?: string | null;
  payrollRate?: number;
};

type CoachDetail = Coach & {
  email?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  certification?: string | null;
  emergencyContact?: string | null;
  attendanceRate?: number;
  totalPtSessions?: number;
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

type EditForm = {
  specialization: string;
  bio: string;
  profileImageUrl: string;
  branchName: string;
  payrollType: string;
  payrollRate: string;
  certification: string;
  isActive: boolean;
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
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  function toggleSort(key: CoachSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const loadCoaches = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
    const res = await fetch(`/api/coaches?${params.toString()}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => [])) as Coach[] | PagedResponse<Coach>;
    if (!res.ok) {
      const msg = typeof payload === "object" && !Array.isArray(payload) ? payload.message : undefined;
      setError(msg ?? "Failed to fetch coaches");
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
      const list = payload.data ?? payload.items ?? [];
      const total = payload.totalCount ?? payload.totalItems ?? payload.total ?? list.length;
      const pages = payload.totalPages ?? payload.pageCount ?? Math.max(1, Math.ceil(total / (payload.pageSize ?? pageSize)));
      setCoaches(list);
      setTotalItems(total);
      setTotalPages(pages);
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
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [coaches, sortKey, sortDir]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailError("");
    setSelected(null);
    setEditMode(false);
    setEditError("");
    const res = await fetch(`/api/coaches/${id}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const payload = (await res.json().catch(() => ({}))) as CoachDetail & { data?: CoachDetail; message?: string };
    if (!res.ok) {
      setDetailError(payload.message ?? "Failed to fetch detail");
      setDetailLoading(false);
      return;
    }
    const coach = payload.data ?? payload;
    setSelected(coach);
    setDetailLoading(false);
  }

  function startEdit(coach: CoachDetail) {
    setEditForm({
      specialization: coach.specialization ?? "",
      bio: coach.bio ?? "",
      profileImageUrl: coach.profileImageUrl ?? "",
      branchName: coach.branchName ?? "",
      payrollType: coach.payrollType ?? "",
      payrollRate: String(coach.payrollRate ?? ""),
      certification: coach.certification ?? "",
      isActive: coach.isActive ?? true,
    });
    setEditMode(true);
    setEditError("");
  }

  async function handleEdit(coachId: string) {
    if (!editForm) return;
    setEditLoading(true);
    setEditError("");
    const body = {
      specialization: editForm.specialization || undefined,
      bio: editForm.bio || undefined,
      profileImageUrl: editForm.profileImageUrl || undefined,
      branchName: editForm.branchName || undefined,
      payrollType: editForm.payrollType || undefined,
      payrollRate: editForm.payrollRate ? Number(editForm.payrollRate) : undefined,
      certification: editForm.certification || undefined,
      isActive: editForm.isActive,
    };
    const res = await fetch(`/api/coaches/${coachId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { message?: string };
    setEditLoading(false);
    if (!res.ok) {
      setEditError(data.message ?? "Failed to update coach");
      return;
    }
    setEditMode(false);
    void loadCoaches(page);
    void openDetail(coachId);
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    const res = await fetch(`/api/coaches/${id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeleteId(null);
    if (res.ok) {
      setSelected(null);
      void loadCoaches(page);
    }
  }

  async function handleToggleStatus(coach: Coach) {
    setStatusLoading(coach.id);
    await fetch(`/api/coaches/${coach.id}/status?isActive=${!coach.isActive}`, { method: "PATCH" });
    setStatusLoading(null);
    void loadCoaches(page);
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
                  <i className={`fas fa-caret-${sortDir === "asc" ? "up" : "down"} text-[10px]`} aria-hidden />
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
                    src={coach.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(coach.fullName || "Coach")}&background=random`}
                    alt=""
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <h3 className="font-bold text-xl text-white">{coach.fullName ?? "—"}</h3>
                <p className="text-gray-400 text-sm mb-1">{coach.specialization ?? "No specialization"}</p>
                {coach.branchName && (
                  <p className="text-xs text-gray-500 mb-3">
                    <i className="fas fa-map-marker-alt mr-1" aria-hidden /> {coach.branchName}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-left">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Classes</p>
                    <p className="font-bold text-lg text-white">
                      {coach.totalClasses ?? 0} <span className="text-xs font-normal">/mo</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Rating</p>
                    <p className="font-bold text-lg text-sweat">
                      {coach.rating ?? 0} <i className="fas fa-star text-xs" aria-hidden />
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void openDetail(coach.id)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm border border-border transition"
                  >
                    View / Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleStatus(coach)}
                    disabled={statusLoading === coach.id}
                    title={coach.isActive ? "Deactivate" : "Activate"}
                    className={`px-3 py-2 rounded-lg text-sm border transition disabled:opacity-50 ${
                      coach.isActive
                        ? "text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10"
                        : "text-green-400 border-green-500/20 hover:bg-green-500/10"
                    }`}
                  >
                    <i className={`fas ${coach.isActive ? "fa-pause" : "fa-play"}`} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(coach.id)}
                    title="Delete"
                    className="px-3 py-2 rounded-lg text-sm border border-red-500/20 text-red-400 hover:bg-red-500/10 transition"
                  >
                    <i className="fas fa-trash" aria-hidden />
                  </button>
                </div>
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
            if (e.currentTarget === e.target) { setSelected(null); setDetailError(""); setDetailLoading(false); setEditMode(false); }
          }}
        >
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase">
                {editMode ? "Edit Coach" : "Coach Detail"}
              </h3>
              <button
                type="button"
                onClick={() => { setSelected(null); setDetailError(""); setDetailLoading(false); setEditMode(false); }}
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
              editMode && editForm ? (
                <div className="space-y-3">
                  {(
                    [
                      ["Specialization", "specialization"],
                      ["Bio", "bio"],
                      ["Profile Image URL", "profileImageUrl"],
                      ["Branch Name", "branchName"],
                      ["Payroll Type", "payrollType"],
                      ["Payroll Rate", "payrollRate"],
                      ["Certification", "certification"],
                    ] as [string, keyof EditForm][]
                  ).map(([label, field]) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input
                        type={field === "payrollRate" ? "number" : "text"}
                        value={String(editForm[field])}
                        onChange={(e) => setEditForm((f) => f ? { ...f, [field]: e.target.value } : f)}
                        className="w-full bg-sidebar border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm((f) => f ? { ...f, isActive: e.target.checked } : f)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-300">Active</label>
                  </div>
                  {editError && <p className="text-red-400 text-xs">{editError}</p>}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => void handleEdit(selected.id)}
                      disabled={editLoading}
                      className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                      {editLoading ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="flex-1 bg-sidebar border border-border text-white py-2 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-gray-300">
                  {[
                    ["Name", selected.fullName],
                    ["Email", selected.email],
                    ["Phone", selected.phoneNumber],
                    ["Specialization", selected.specialization],
                    ["Branch", selected.branchName],
                    ["Certification", selected.certification],
                    ["Total Members", selected.totalMembers],
                    ["Total Classes", selected.totalClasses],
                    ["Attendance Rate", selected.attendanceRate != null ? `${selected.attendanceRate}%` : null],
                    ["PT Sessions", selected.totalPtSessions],
                    ["Payroll Type", selected.payrollType],
                    ["Payroll Rate", selected.payrollRate != null ? `Rp ${selected.payrollRate.toLocaleString("id-ID")}` : null],
                    ["Emergency Contact", selected.emergencyContact],
                    ["Bio", selected.bio],
                    ["Status", selected.isActive ? "Active" : "Inactive"],
                  ].map(([label, val]) =>
                    val != null ? (
                      <p key={String(label)}>
                        <span className="text-gray-500">{label}:</span> {String(val)}
                      </p>
                    ) : null
                  )}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => startEdit(selected)}
                      className="bg-sweat/10 border border-sweat/30 text-sweat px-4 py-2 rounded-lg text-sm font-bold hover:bg-sweat/20 transition"
                    >
                      <i className="fas fa-edit mr-2" aria-hidden />
                      Edit Coach
                    </button>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-red-500/30 shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-2">Delete Coach?</h3>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleDelete(deleteId)}
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
    </>
  );
}
