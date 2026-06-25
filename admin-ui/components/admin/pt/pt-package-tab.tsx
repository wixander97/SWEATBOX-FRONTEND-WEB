"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import {
  PtPackageFormModal,
  type PtPackageFormValues,
} from "@/components/admin/pt/pt-package-form-modal";
import {
  type Coach,
  type Member,
  type PtPackage,
  coachLabel,
  memberLabel,
  parseList,
  parseTotal,
  type PagedResponse,
} from "@/components/admin/pt/pt-types";

type SortDir = "asc" | "desc";

export function PtPackageTab() {
  const [packages, setPackages] = useState<PtPackage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PtPackage | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const loadPackages = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      try {
        const res = await authFetch(`${API_BASE_URL}/api/PTPackages?${params.toString()}`, {
          cache: "no-store",
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => [])) as
          | PtPackage[]
          | PagedResponse<PtPackage>;
        if (!res.ok) {
          const msg =
            typeof payload === "object" && !Array.isArray(payload)
              ? payload.message
              : "Gagal mengambil PT packages";
          setError(msg || "Gagal mengambil PT packages");
          setPackages([]);
          setTotalItems(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
        const list = parseList(payload);
        const { totalItems: ti, totalPages: tp } = parseTotal(payload, list, pageSize);
        setPackages(list);
        setTotalItems(ti);
        setTotalPages(tp);
      } catch {
        setError("Gagal mengambil PT packages");
        setPackages([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  const loadCoaches = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/coaches?page=1&pageSize=100`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => [])) as Coach[] | PagedResponse<Coach>;
      if (res.ok) setCoaches(parseList(payload));
    } catch {
      // ignore — coaches dropdown stays empty
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/members?page=1&pageSize=1000`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => [])) as Member[] | PagedResponse<Member>;
      if (res.ok) setMembers(parseList(payload));
    } catch {
      // ignore — members dropdown stays empty
    }
  }, []);

  useEffect(() => {
    void loadPackages(page);
  }, [loadPackages, page]);
  useEffect(() => {
    void loadCoaches();
    void loadMembers();
  }, [loadCoaches, loadMembers]);

  const coachOptions = useMemo(
    () => coaches.map((c) => ({ id: c.id, label: coachLabel(c) })),
    [coaches]
  );
  const memberOptions = useMemo(
    () => members.map((m) => ({ id: m.id, label: memberLabel(m) })),
    [members]
  );

  const sortedPackages = useMemo(() => {
    if (!sortKey) return packages;
    return [...packages].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? "";
      const bv = (b as Record<string, unknown>)[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [packages, sortKey, sortDir]);

  function coachName(id?: string | null): string {
    if (!id) return "-";
    const found = coaches.find((c) => c.id === id);
    return found ? coachLabel(found) : id;
  }

  function memberName(id?: string | null): string {
    if (!id) return "-";
    const found = members.find((m) => m.id === id);
    return found ? memberLabel(found) : id;
  }

  async function handleCreate(values: PtPackageFormValues) {
    setSaving(true);
    setError("");
    try {
      const body = {
        memberId: values.memberId,
        name: values.name,
        coachId: values.coachId,
        sessionCount: values.sessionCount,
        price: values.price,
        description: values.description,
      };
      const res = await authFetch(`${API_BASE_URL}/api/PTPackages`, {
        method: "POST",
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message ?? "Gagal membuat PT package");
      }
      setCreateOpen(false);
      void loadPackages(page);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(values: PtPackageFormValues) {
    if (!editTarget) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        memberId: values.memberId,
        name: values.name,
        coachId: values.coachId,
        sessionCount: values.sessionCount,
        price: values.price,
        isActive: values.isActive,
        description: values.description,
      };
      const res = await authFetch(`${API_BASE_URL}/api/PTPackages/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message ?? "Gagal memperbarui PT package");
      }
      setEditTarget(null);
      void loadPackages(page);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pkg: PtPackage) {
    const yes = window.confirm(`Hapus PT package "${pkg.name}"?`);
    if (!yes) return;
    setError("");
    try {
      const res = await authFetch(`${API_BASE_URL}/api/PTPackages/${pkg.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data?.message ?? "Gagal menghapus PT package");
        return;
      }
      void loadPackages(page);
    } catch {
      setError("Gagal menghapus PT package");
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-display font-bold text-white">PT Packages</h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <i className="fas fa-plus" aria-hidden /> Create Package
        </button>
      </div>

      {error && (
        <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
            <tr>
              <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1.5 hover:text-white transition">
                  Name
                  <span className="flex flex-col -space-y-1.5">
                    <i className={`fas fa-caret-up text-[10px] ${sortKey === "name" && sortDir === "asc" ? "text-sweat" : "text-gray-600"}`} aria-hidden />
                    <i className={`fas fa-caret-down text-[10px] ${sortKey === "name" && sortDir === "desc" ? "text-sweat" : "text-gray-600"}`} aria-hidden />
                  </span>
                </span>
              </th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Coach</th>
              <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("sessionCount")}>
                <span className="flex items-center gap-1.5 hover:text-white transition">
                  Sessions
                  <span className="flex flex-col -space-y-1.5">
                    <i className={`fas fa-caret-up text-[10px] ${sortKey === "sessionCount" && sortDir === "asc" ? "text-sweat" : "text-gray-600"}`} aria-hidden />
                    <i className={`fas fa-caret-down text-[10px] ${sortKey === "sessionCount" && sortDir === "desc" ? "text-sweat" : "text-gray-600"}`} aria-hidden />
                  </span>
                </span>
              </th>
              <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("price")}>
                <span className="flex items-center gap-1.5 hover:text-white transition">
                  Price
                  <span className="flex flex-col -space-y-1.5">
                    <i className={`fas fa-caret-up text-[10px] ${sortKey === "price" && sortDir === "asc" ? "text-sweat" : "text-gray-600"}`} aria-hidden />
                    <i className={`fas fa-caret-down text-[10px] ${sortKey === "price" && sortDir === "desc" ? "text-sweat" : "text-gray-600"}`} aria-hidden />
                  </span>
                </span>
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : sortedPackages.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada PT package.
                </td>
              </tr>
            ) : (
              sortedPackages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3 font-semibold text-white">{pkg.name}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {pkg.memberName || memberName(pkg.memberId)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {pkg.coachName || coachName(pkg.coachId)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{pkg.sessionCount ?? 0}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {pkg.price != null ? Number(pkg.price).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pkg.isActive
                          ? "bg-green-500/15 text-green-400"
                          : "bg-gray-500/15 text-gray-400"
                      }`}
                    >
                      {pkg.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={pkg.description ?? ""}>
                    {pkg.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => setEditTarget(pkg)}
                      className="text-gray-400 hover:text-white mx-1"
                    >
                      <i className="fas fa-edit" aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => void handleDelete(pkg)}
                      className="text-red-500 hover:text-red-400 mx-1"
                    >
                      <i className="fas fa-trash" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500">
            Total {totalItems} item
          </span>
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

      {createOpen && (
        <PtPackageFormModal
          title="Create PT Package"
          submitLabel="Create"
          coachOptions={coachOptions}
          memberOptions={memberOptions}
          saving={saving}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editTarget && (
        <PtPackageFormModal
          title="Edit PT Package"
          submitLabel="Save"
          isEdit
          coachOptions={coachOptions}
          memberOptions={memberOptions}
          saving={saving}
          initialValues={{
            memberId: editTarget.memberId ?? "",
            name: editTarget.name,
            coachId: editTarget.coachId ?? "",
            sessionCount: editTarget.sessionCount ?? 0,
            price: editTarget.price ?? 0,
            isActive: editTarget.isActive ?? true,
            description: editTarget.description ?? "",
          }}
          onClose={() => setEditTarget(null)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  );
}
