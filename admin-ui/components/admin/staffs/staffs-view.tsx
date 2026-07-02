"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { EditStaffModal } from "@/components/admin/staffs/edit-staff-modal";
import {
  type Branch,
  type PagedResponse,
  type Staff,
} from "@/components/admin/staffs/staffs.types";

type IsActiveFilter = "all" | "true" | "false";

export function StaffsView() {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<IsActiveFilter>("all");
  const [branchId, setBranchId] = useState("");
  const [department, setDepartment] = useState("");
  const [departmentInput, setDepartmentInput] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/branches`);
        if (res.ok) {
          const data = (await res.json()) as Branch[];
          setBranches(data.filter((b) => b.isActive));
        }
      } catch {
        // silently fail
      } finally {
        setBranchesLoading(false);
      }
    }
    void loadBranches();
  }, []);

  const loadStaffs = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      const trimmedSearch = search.trim();
      if (trimmedSearch) params.set("search", trimmedSearch);
      if (isActiveFilter !== "all") params.set("isActive", isActiveFilter);
      if (branchId) params.set("branchName", branchId);
      const trimmedDept = department.trim();
      if (trimmedDept) params.set("department", trimmedDept);

      const res = await authFetch(
        `${API_BASE_URL}/api/v1/staffs/paged?${params.toString()}`,
        { cache: "no-store" }
      );
      if (redirectToLoginIfUnauthorized(res.status)) {
        setLoading(false);
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as
        | Staff[]
        | PagedResponse<Staff>;
      if (!res.ok) {
        const msg =
          typeof payload === "object" && !Array.isArray(payload)
            ? payload.message
            : undefined;
        setError(msg ?? "Gagal mengambil data staff.");
        setStaffs([]);
        setTotalItems(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }
      if (Array.isArray(payload)) {
        setStaffs(payload);
        setTotalItems(payload.length);
        setTotalPages(1);
      } else {
        const list = payload.items ?? payload.data ?? [];
        const total =
          payload.totalCount ??
          payload.totalItems ??
          payload.total ??
          list.length;
        const pages =
          payload.totalPages ??
          payload.pageCount ??
          Math.max(1, Math.ceil(total / (payload.pageSize ?? pageSize)));
        setStaffs(list);
        setTotalItems(total);
        setTotalPages(pages);
      }
      setLoading(false);
    },
    [pageSize, search, isActiveFilter, branchId, department]
  );

  useEffect(() => {
    void loadStaffs(page);
  }, [loadStaffs, page]);

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setIsActiveFilter("all");
    setBranchId("");
    setDepartmentInput("");
    setDepartment("");
    setPage(1);
  }

  // Debounce text inputs -> committed filter values (auto-apply without spamming the API).
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDepartment(departmentInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [departmentInput]);

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    setDeleteError("");
    const res = await authFetch(`${API_BASE_URL}/api/v1/staffs/${id}`, {
      method: "DELETE",
    });
    if (redirectToLoginIfUnauthorized(res.status)) {
      setDeleteLoading(false);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      setDeleteError(data.message ?? "Gagal menghapus staff.");
      setDeleteLoading(false);
      return;
    }
    setDeleteLoading(false);
    setDeleteId(null);
    void loadStaffs(page);
  }

  async function exportCsv() {
    setExporting(true);
    setExportError("");
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/staffs`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) {
        setExporting(false);
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as
        | Staff[]
        | { data?: Staff[]; items?: Staff[]; message?: string };
      if (!res.ok) {
        const msg =
          typeof payload === "object" && !Array.isArray(payload)
            ? payload.message
            : undefined;
        setExportError(msg ?? "Gagal mengambil data staff untuk export.");
        setExporting(false);
        return;
      }
      const list = Array.isArray(payload)
        ? payload
        : (payload.items ?? payload.data ?? []);

      const fmtDate = (v?: number | string | null) => {
        if (v == null || v === "") return "-";
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("id-ID");
      };
      const val = (s?: string | null) => s || "-";
      const money = (n?: number | null) =>
        n != null ? `Rp ${Number(n).toLocaleString("id-ID")}` : "-";
      const yesNo = (v?: boolean | null) => (v ? "Yes" : "No");

      const header = [
        "Full Name",
        "Email",
        "Phone",
        "Department",
        "Position",
        "Branch",
        "Specialization",
        "Role",
        "Payroll Type",
        "Payroll Rate",
        "Salary",
        "Hire Date",
        "Status",
      ];
      const rows = list.map((s) => [
        val(s.fullName),
        val(s.email),
        val(s.phoneNumber),
        val(s.department),
        val(s.position),
        val(s.branchName),
        val(s.specialization),
        val(s.roleName),
        val(s.payrollType),
        money(s.payrollRate),
        money(s.salary),
        fmtDate(s.hireDate),
        yesNo(s.isActive),
      ]);
      const csv = [header, ...rows]
        .map((r) =>
          r.map((c) => `"${String(c).replaceAll("\"", "\"\"")}"`).join(",")
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "staffs.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Gagal mengambil data staff untuk export.");
    } finally {
      setExporting(false);
    }
  }

  const inputCls =
    "bg-sidebar border border-border text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat";
  const selectCls = inputCls;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Filters */}
      <div className="p-4 sm:p-6 border-b border-border flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold font-display uppercase">Staff Management</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={exporting}
              title="Export semua data staff (tanpa filter)"
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition disabled:opacity-50"
            >
              {exporting ? (
                <i className="fas fa-spinner fa-spin mr-2" aria-hidden />
              ) : (
                <i className="fas fa-file-export mr-2" aria-hidden />
              )}
              Export CSV
            </button>
          </div>
        </div>
        {exportError && (
          <p className="text-red-400 text-sm">{exportError}</p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 sm:flex-wrap">
          <div className="relative sm:w-56">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none" aria-hidden />
            <input
              type="text"
              placeholder="Cari nama / email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            value={isActiveFilter}
            onChange={(e) => {
              setIsActiveFilter(e.target.value as IsActiveFilter);
              setPage(1);
            }}
            className={`${selectCls} sm:w-36`}
          >
            <option value="all">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
            }}
            disabled={branchesLoading}
            className={`${selectCls} sm:w-44`}
          >
            <option value="">
              {branchesLoading ? "Memuat Branch..." : "All Branches"}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branchName ?? b.id}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Department..."
            value={departmentInput}
            onChange={(e) => setDepartmentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setDepartment(departmentInput);
                setPage(1);
              }
            }}
            className={`${inputCls} sm:w-44`}
          />
          <button
            type="button"
            onClick={resetFilters}
            className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition sm:ml-auto"
          >
            <i className="fas fa-undo mr-2" aria-hidden />
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm text-gray-400">
          <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
            <tr>
              <th className="px-6 py-4">Staff Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">Position</th>
              <th className="px-6 py-4">Branch</th>
              <th className="px-6 py-4">Status</th>
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
            ) : staffs.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-gray-400" colSpan={8}>
                  Tidak ada data staff.
                </td>
              </tr>
            ) : (
              staffs.map((s) => (
                <tr key={s.id} className="table-row transition">
                  <td className="px-6 py-4 font-bold text-white">
                    <span className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden inline-block shrink-0">
                        <Image
                          src={
                            s.profileImageUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              s.fullName || "Staff"
                            )}&background=random`
                          }
                          alt=""
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </span>
                      {s.fullName || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4">{s.email || "—"}</td>
                  <td className="px-6 py-4">{s.phoneNumber || "—"}</td>
                  <td className="px-6 py-4">{s.department || "—"}</td>
                  <td className="px-6 py-4">{s.position || "—"}</td>
                  <td className="px-6 py-4">{s.branchName || "—"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold border ${
                        s.isActive
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      }`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditId(s.id)}
                        title="Detail / Edit"
                        className="bg-sweat text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-400 transition inline-flex items-center gap-1.5"
                      >
                        <i className="fas fa-edit" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteId(s.id);
                          setDeleteError("");
                        }}
                        title="Delete"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition"
                      >
                        <i className="fas fa-trash" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      {editId && (
        <EditStaffModal
          staffId={editId}
          branches={branches}
          branchesLoading={branchesLoading}
          onClose={() => setEditId(null)}
          onSuccess={() => {
            setEditId(null);
            void loadStaffs(page);
          }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-red-500/30 shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-2">Delete Staff?</h3>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            {deleteError && (
              <p className="text-red-400 text-sm mb-3">{deleteError}</p>
            )}
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
    </div>
  );
}
