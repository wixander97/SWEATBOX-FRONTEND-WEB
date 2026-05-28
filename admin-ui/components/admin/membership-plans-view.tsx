"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CreateMembershipPlanModal,
    type MembershipPlanFormValues,
} from "@/components/admin/create-membership-plan-modal";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type SortDir = "asc" | "desc";

type ApiMembershipPlan = {
    id: string;
    planName: string;
    description?: string | null;
    price?: number;
    credits: number;
    validityDays: number;
    isActive: boolean;
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

export function MembershipPlansView() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [plans, setPlans] = useState<ApiMembershipPlan[]>([]);
    const [selected, setSelected] = useState<ApiMembershipPlan | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

    function toggleSort(key: string) {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }

    const loadPlans = useCallback(async (targetPage: number) => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
            page: String(targetPage),
            pageSize: String(pageSize),
        });
        const res = await fetch(`/api/v1/membership-plans?${params.toString()}`, {
            cache: "no-store",
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => [])) as
            | ApiMembershipPlan[]
            | PagedResponse<ApiMembershipPlan>;
        if (!res.ok) {
            const msg =
                typeof payload === "object" && !Array.isArray(payload)
                    ? payload.message
                    : "Gagal mengambil membership plans";
            setError(msg || "Gagal mengambil membership plans");
            setPlans([]);
            setTotalItems(0);
            setTotalPages(1);
            setLoading(false);
            return;
        }
        if (Array.isArray(payload)) {
            setPlans(payload);
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
            setPlans(list);
            setTotalItems(computedTotalItems);
            setTotalPages(computedTotalPages);
        }
        setLoading(false);
    }, [pageSize]);

    useEffect(() => {
        void loadPlans(page);
    }, [loadPlans, page]);

    const filteredPlans = useMemo(() => {
        if (filterActive === "all") return plans;
        if (filterActive === "active") return plans.filter((p) => p.isActive);
        return plans.filter((p) => !p.isActive);
    }, [plans, filterActive]);

    const mappedRows = useMemo(() => {
        const rows = filteredPlans.map((p) => ({
            ...p,
            priceDisplay: p.price ? `Rp ${p.price.toLocaleString("id-ID")}` : "-",
            validityDisplay: `${p.validityDays} hari`,
            statusBadge: p.isActive
                ? "bg-green-500/15 text-green-200 border border-green-500/35"
                : "bg-red-500/15 text-red-200 border border-red-500/35",
            statusText: p.isActive ? "Active" : "Inactive",
        }));
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
    }, [filteredPlans, sortKey, sortDir]);

    async function createPlan(values: MembershipPlanFormValues) {
        const res = await fetch("/api/v1/membership-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
            throw new Error(payload.message || "Create membership plan gagal");
        }
        await loadPlans(page);
    }

    async function updatePlan(values: MembershipPlanFormValues) {
        if (!selected) return;
        const res = await fetch(`/api/v1/membership-plans/${selected.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
            throw new Error(payload.message || "Update membership plan gagal");
        }
        await loadPlans(page);
    }

    async function deletePlan(id: string) {
        const yes = window.confirm("Delete this membership plan?");
        if (!yes) return;
        const res = await fetch(`/api/v1/membership-plans/${id}`, {
            method: "DELETE",
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
            window.alert(payload.message || "Delete membership plan gagal");
            return;
        }
        await loadPlans(page);
    }

    return (
        <>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-border flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <select
                                value={filterActive}
                                onChange={(e) =>
                                    setFilterActive(e.target.value as "all" | "active" | "inactive")
                                }
                                className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat"
                            >
                                <option value="all">All Plans</option>
                                <option value="active">Active Plans</option>
                                <option value="inactive">Inactive Plans</option>
                            </select>
                        </div>
                        <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-bold uppercase tracking-wide text-gray-400">
                                Status
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-400" aria-hidden />
                                Active
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-400" aria-hidden />
                                Inactive
                            </span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setSelected(null);
                            setModalOpen(true);
                        }}
                        className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <i className="fas fa-plus" aria-hidden />
                        Create New Plan
                    </button>
                </div>
                {error && (
                    <div className="p-4 sm:p-6 bg-red-500/10 border-b border-red-500/30 text-red-200 text-sm">
                        {error}
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm text-gray-400">
                        <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                            <tr>
                                {(
                                    [
                                        { label: "Plan Name", key: "planName" },
                                        { label: "Credits", key: "credits" },
                                        { label: "Validity", key: "validityDays" },
                                        { label: "Price", key: "price" },
                                        { label: "Status", key: "statusText" },
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
                                                    className={`fas fa-caret-up ${sortKey === key && sortDir === "asc"
                                                        ? "text-sweat"
                                                        : "text-gray-600 group-hover:text-gray-400"
                                                        }`}
                                                    aria-hidden
                                                />
                                                <i
                                                    className={`fas fa-caret-down ${sortKey === key && sortDir === "desc"
                                                        ? "text-sweat"
                                                        : "text-gray-600 group-hover:text-gray-400"
                                                        }`}
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
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-sweat border-t-transparent" />
                                    </td>
                                </tr>
                            ) : mappedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No membership plans found
                                    </td>
                                </tr>
                            ) : (
                                mappedRows.map((plan) => (
                                    <tr key={plan.id} className="hover:bg-sidebar/50 transition">
                                        <td className="px-6 py-4 font-semibold text-white">
                                            {plan.planName}
                                        </td>
                                        <td className="px-6 py-4">{plan.credits}</td>
                                        <td className="px-6 py-4">{plan.validityDisplay}</td>
                                        <td className="px-6 py-4">{plan.priceDisplay}</td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${plan.statusBadge}`}
                                            >
                                                {plan.statusText}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelected(plan);
                                                        setEditOpen(true);
                                                    }}
                                                    className="text-blue-400 hover:text-blue-300 transition text-xs font-semibold"
                                                >
                                                    <i className="fas fa-edit" aria-hidden /> Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void deletePlan(plan.id)}
                                                    className="text-red-400 hover:text-red-300 transition text-xs font-semibold"
                                                >
                                                    <i className="fas fa-trash" aria-hidden /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="p-4 sm:p-6 border-t border-border flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            Page {page} of {totalPages} • {totalItems} total plans
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="bg-sidebar border border-border text-gray-400 px-3 py-1 rounded text-xs font-semibold hover:border-sweat hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <i className="fas fa-chevron-left" aria-hidden />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="bg-sidebar border border-border text-gray-400 px-3 py-1 rounded text-xs font-semibold hover:border-sweat hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <i className="fas fa-chevron-right" aria-hidden />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <CreateMembershipPlanModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelected(null);
                }}
                onSubmit={async (values) => {
                    try {
                        await createPlan(values);
                        setModalOpen(false);
                        setSelected(null);
                    } catch (err) {
                        window.alert(
                            err instanceof Error ? err.message : "Something went wrong"
                        );
                    }
                }}
            />

            {selected && (
                <CreateMembershipPlanModal
                    isOpen={editOpen}
                    initialValues={{
                        planName: selected.planName,
                        description: selected.description ?? "",
                        price: selected.price ?? 0,
                        credits: selected.credits,
                        validityDays: selected.validityDays,
                        isActive: selected.isActive,
                    }}
                    onClose={() => {
                        setEditOpen(false);
                        setSelected(null);
                    }}
                    onSubmit={async (values) => {
                        try {
                            await updatePlan(values);
                            setEditOpen(false);
                            setSelected(null);
                        } catch (err) {
                            window.alert(
                                err instanceof Error ? err.message : "Something went wrong"
                            );
                        }
                    }}
                    isEdit
                />
            )}
        </>
    );
}
