"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { CreateCoachModal } from "./create-coach-modal";
import { EditCoachModal } from "./edit-coach-modal";

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
  branchName: string;
  payrollType: string;
  payrollRate: string;
  certification: string;
  isActive: boolean;
};

type AddForm = {
  userId: string;
  branchId: string;
  specialization: string;
  bio: string;
  rating: string;
  attendanceRate: string;
  totalClasses: string;
  totalMembers: string;
  totalPtSessions: string;
  payrollType: string;
  payrollRate: string;
  certification: string;
  emergencyContact: string;
  isActive: boolean;
};

type UserOption = {
  id: string;
  fullName?: string | null;
  email?: string | null;
};

type BranchOption = {
  id: string;
  branchName?: string | null;
  isActive: boolean;
};

type CoachAttendanceRecord = {
  classDate: string;
  className: string;
  branchName?: string | null;
  isPresent: boolean;
  status: string;
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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const defaultAddForm: AddForm = {
    userId: "",
    branchId: "",
    specialization: "",
    bio: "",
    rating: "0",
    attendanceRate: "0",
    totalClasses: "0",
    totalMembers: "0",
    totalPtSessions: "0",
    payrollType: "",
    payrollRate: "0",
    certification: "",
    emergencyContact: "",
    isActive: true,
  };
  const [addForm, setAddForm] = useState<AddForm>(defaultAddForm);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");
  const [attendanceHistory, setAttendanceHistory] = useState<CoachAttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");

  function toggleSort(key: CoachSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function loadUsers() {
    setUsersLoading(true);
    const params = new URLSearchParams({ page: "1", pageSize: "100", isActive: "true", roleId: "6a3efc88-def9-4b73-b328-9570b704341d" });
    const res = await authFetch(`/api/v1/users/paged?${params.toString()}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) { setUsersLoading(false); return; }
    const payload = await res.json().catch(() => ({}));
    // Handle various response structures: { data: [] }, { items: [] }, or direct array
    let list: UserOption[] = [];
    if (Array.isArray(payload)) {
      list = payload as UserOption[];
    } else if (payload.data && Array.isArray(payload.data)) {
      list = payload.data;
    } else if (payload.items && Array.isArray(payload.items)) {
      list = payload.items;
    }
    setUsers(list);
    setUsersLoading(false);
  }

  async function loadBranches() {
    setBranchesLoading(true);
    const res = await authFetch(`${API_BASE_URL}/api/v1/branches`);
    if (redirectToLoginIfUnauthorized(res.status)) { setBranchesLoading(false); return; }
    const payload = await res.json().catch(() => []);
    let list: BranchOption[] = [];
    if (Array.isArray(payload)) {
      list = payload as BranchOption[];
    } else if (payload.data && Array.isArray(payload.data)) {
      list = payload.data;
    } else if (payload.items && Array.isArray(payload.items)) {
      list = payload.items;
    }
    setBranches(list);
    setBranchesLoading(false);
  }

  function openAddModal() {
    setAddForm(defaultAddForm);
    setAddError("");
    setAddModalOpen(true);
    void loadUsers();
    void loadBranches();
  }

  async function handleAddCoach() {
    if (!addForm.userId) {
      setAddError("Please select a user.");
      return;
    }
    if (!addForm.specialization.trim()) {
      setAddError("Specialization is required.");
      return;
    }
    setAddLoading(true);
    setAddError("");
    const body = {
      userId: addForm.userId,
      branchId: addForm.branchId || undefined,
      specialization: addForm.specialization,
      bio: addForm.bio || undefined,
      rating: Number(addForm.rating) || 0,
      attendanceRate: Number(addForm.attendanceRate) || 0,
      totalClasses: Number(addForm.totalClasses) || 0,
      totalMembers: Number(addForm.totalMembers) || 0,
      totalPtSessions: Number(addForm.totalPtSessions) || 0,
      payrollType: addForm.payrollType || undefined,
      payrollRate: Number(addForm.payrollRate) || 0,
      certification: addForm.certification || undefined,
      emergencyContact: addForm.emergencyContact || undefined,
      isActive: addForm.isActive,
    };
    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { message?: string };
    setAddLoading(false);
    if (!res.ok) {
      setAddError(data.message ?? "Failed to create coach");
      return;
    }
    setAddModalOpen(false);
    setAddForm(defaultAddForm);
    void loadCoaches(page);
  }

  const loadCoaches = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches?${params.toString()}`, { cache: "no-store" });
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
    setDetailTab("info");
    setAttendanceHistory([]);
    setAttendanceError("");
    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches/${id}`, { cache: "no-store" });
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

  async function loadAttendanceHistory(coachId: string) {
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/coaches/${coachId}/attendance-history`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (res.ok) {
        const payload = await res.json();
        const list = Array.isArray(payload) ? payload : (payload.items ?? payload.data ?? []);
        setAttendanceHistory(list);
      } else {
        setAttendanceError("Failed to load attendance history");
        setAttendanceHistory([]);
      }
    } catch {
      setAttendanceError("Failed to load attendance history");
      setAttendanceHistory([]);
    } finally {
      setAttendanceLoading(false);
    }
  }

  function startEdit(coach: CoachDetail) {
    setEditForm({
      specialization: coach.specialization ?? "",
      bio: coach.bio ?? "",
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
      branchName: editForm.branchName || undefined,
      payrollType: editForm.payrollType || undefined,
      payrollRate: editForm.payrollRate ? Number(editForm.payrollRate) : undefined,
      certification: editForm.certification || undefined,
      isActive: editForm.isActive,
    };
    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches/${coachId}`, {
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
    const res = await authFetch(`${API_BASE_URL}/api/v1/coaches/${id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeleteId(null);
    if (res.ok) {
      setSelected(null);
      void loadCoaches(page);
    }
  }

  async function handleToggleStatus(coach: Coach) {
    setStatusLoading(coach.id);
    await authFetch(`${API_BASE_URL}/api/v1/coaches/${coach.id}/status?isActive=${!coach.isActive}`, { method: "PATCH" });
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
            <button
              type="button"
              onClick={() => openAddModal()}
              className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-sweat/80 transition"
            >
              <i className="fas fa-plus mr-2" aria-hidden /> Add New Coach
            </button>
            <span className="text-xs text-gray-500 uppercase font-bold mr-1 ml-2">Sort by:</span>
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
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border transition ${sortKey === key
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
                    className={`px-3 py-2 rounded-lg text-sm border transition disabled:opacity-50 ${coach.isActive
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

      {addModalOpen && (
        <CreateCoachModal
          onClose={() => setAddModalOpen(false)}
          onSuccess={() => { void loadCoaches(page); setAddModalOpen(false); }}
        />
      )}

      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => {
            if (e.currentTarget === e.target) { setSelected(null); setDetailError(""); setDetailLoading(false); }
          }}
        >
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase">Coach Detail</h3>
              <button
                type="button"
                onClick={() => { setSelected(null); setDetailError(""); setDetailLoading(false); }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Tab Buttons */}
            <div className="flex gap-1 mb-4 border-b border-border">
              <button
                type="button"
                onClick={() => setDetailTab("info")}
                className={`px-4 py-2 text-sm font-bold transition border-b-2 ${
                  detailTab === "info"
                    ? "border-sweat text-sweat"
                    : "border-transparent text-gray-500 hover:text-white"
                }`}
              >
                Info
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailTab("history");
                  if (selected && attendanceHistory.length === 0 && !attendanceLoading) {
                    void loadAttendanceHistory(selected.id);
                  }
                }}
                className={`px-4 py-2 text-sm font-bold transition border-b-2 ${
                  detailTab === "history"
                    ? "border-sweat text-sweat"
                    : "border-transparent text-gray-500 hover:text-white"
                }`}
              >
                History
              </button>
            </div>

            {detailLoading ? (
              <p className="text-gray-400">Loading detail...</p>
            ) : detailError ? (
              <p className="text-red-400">{detailError}</p>
            ) : detailTab === "info" ? (
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
                    onClick={() => setSelected(null)}
                    className="bg-sweat/10 border border-sweat/30 text-sweat px-4 py-2 rounded-lg text-sm font-bold hover:bg-sweat/20 transition mr-2"
                  >
                    <i className="fas fa-edit mr-2" aria-hidden />
                    Edit Coach
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {attendanceLoading ? (
                  <p className="text-gray-400 text-center py-8">Loading attendance history...</p>
                ) : attendanceError ? (
                  <p className="text-red-400 text-center py-8">{attendanceError}</p>
                ) : attendanceHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No attendance history found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                      <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Class</th>
                          <th className="px-3 py-2">Branch</th>
                          <th className="px-3 py-2 text-center">Present</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {attendanceHistory.map((record, idx) => (
                          <tr key={idx} className="transition hover:bg-white/5">
                            <td className="px-3 py-2 text-white text-xs">
                              {new Date(record.classDate).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-3 py-2 text-xs">{record.className}</td>
                            <td className="px-3 py-2 text-xs">{record.branchName || "—"}</td>
                            <td className="px-3 py-2 text-center">
                              {record.isPresent ? (
                                <span className="text-green-500">
                                  <i className="fas fa-check" aria-hidden />
                                </span>
                              ) : (
                                <span className="text-red-500">
                                  <i className="fas fa-times" aria-hidden />
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/20">
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Coach Modal - shown when Edit button is clicked */}
      {selected && (
        <EditCoachModal
          coach={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => { void loadCoaches(page); setSelected(null); }}
        />
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
