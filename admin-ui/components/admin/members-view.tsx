"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type FilterTab = "all" | "active";
type SortKey = keyof ApiMember;
type SortDir = "asc" | "desc";

type ApiMember = {
  id: string;
  memberCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  membershipType?: string | null;
  membershipStatus?: string | null;
  paymentStatus?: string | null;
  remainingCredits?: number;
  homeClub?: string | null;
  phoneNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

type MemberFormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  membershipType: string;
  membershipStatus: string;
  paymentStatus: string;
  remainingCredits: string;
  homeClub: string;
  expiryDate: string;
  notes: string;
  isActive: boolean;
};

function emptyMemberForm(): MemberFormState {
  return {
    fullName: "",
    email: "",
    phoneNumber: "",
    membershipType: "",
    membershipStatus: "Active",
    paymentStatus: "",
    remainingCredits: "0",
    homeClub: "",
    expiryDate: "",
    notes: "",
    isActive: true,
  };
}

function memberToForm(m: ApiMember): MemberFormState {
  let exp = "";
  if (m.expiryDate) {
    const d = new Date(m.expiryDate);
    if (!isNaN(d.getTime())) {
      exp = d.toISOString().slice(0, 10);
    }
  }
  return {
    fullName: m.fullName ?? "",
    email: m.email ?? "",
    phoneNumber: m.phoneNumber ?? "",
    membershipType: m.membershipType ?? "",
    membershipStatus: m.membershipStatus ?? "",
    paymentStatus: m.paymentStatus ?? "",
    remainingCredits: String(m.remainingCredits ?? 0),
    homeClub: m.homeClub ?? "",
    expiryDate: exp,
    notes: m.notes ?? "",
    isActive: m.isActive !== false,
  };
}

type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  page?: number;
  pageNumber?: number;
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  message?: string;
};

function statusStyle(status: string) {
  let s = "bg-gray-500/10 text-gray-500";
  if (status === "Active") {
    s = "bg-green-500/10 text-green-500 border border-green-500/20";
  }
  if (status === "Expiring Soon") {
    s =
      "bg-yellow-500/10 text-yellow-500 border border-yellow-500/50 animate-pulse";
  }
  if (status === "Expired") {
    s = "bg-red-500/10 text-red-500";
  }
  return s;
}

export function MembersView() {
  const [memberFilterTab, setMemberFilterTab] = useState<FilterTab>("all");
  const [keyword, setKeyword] = useState("");
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Magic search state
  const [magicQuery, setMagicQuery] = useState("");
  const [magicResults, setMagicResults] = useState<ApiMember[]>([]);
  const [magicLoading, setMagicLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [memberModal, setMemberModal] = useState<null | { mode: "create" } | { mode: "edit"; id: string }>(
    null
  );
  const [memberForm, setMemberForm] = useState<MemberFormState>(emptyMemberForm);
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberModalError, setMemberModalError] = useState("");

  const loadMembers = useCallback(
    async (q: string, tab: FilterTab, targetPage: number) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        search: q,
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (tab === "active") {
        params.set("isActive", "true");
      }

      const res = await fetch(`/api/members?${params.toString()}`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => [])) as
        | ApiMember[]
        | PagedResponse<ApiMember>;

      if (!res.ok) {
        const msg =
          typeof payload === "object" && !Array.isArray(payload)
            ? payload.message
            : "Gagal mengambil data member";
        setError(msg || "Gagal mengambil data member");
        setMembers([]);
        setTotalItems(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      if (Array.isArray(payload)) {
        setMembers(payload);
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
        setMembers(list);
        setTotalItems(computedTotalItems);
        setTotalPages(computedTotalPages);
      }
      setLoading(false);
    },
    [pageSize]
  );

  useEffect(() => {
    void loadMembers(keyword, memberFilterTab, page);
  }, [loadMembers, keyword, memberFilterTab, page]);

  // Magic search – debounced fetch from /api/v1/members/search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!magicQuery.trim()) {
      setMagicResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setMagicLoading(true);
      try {
        const res = await fetch(
          `/api/members/search?keyword=${encodeURIComponent(magicQuery)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = (await res.json()) as ApiMember[] | { items?: ApiMember[]; data?: ApiMember[] };
          const list = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
          setMagicResults(list.slice(0, 8));
          setShowDropdown(true);
        }
      } finally {
        setMagicLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [magicQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function selectMagicResult(member: ApiMember) {
    setKeyword(member.fullName ?? member.memberCode ?? "");
    setMagicQuery(member.fullName ?? member.memberCode ?? "");
    setShowDropdown(false);
    setPage(1);
  }

  const displayMembers = useMemo(() => {
    if (!sortKey) return members;
    return [...members].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [members, sortKey, sortDir]);

  async function openEditMember(m: ApiMember) {
    setMemberModalError("");
    setMemberForm(memberToForm(m));
    setMemberModal({ mode: "edit", id: m.id });
    const res = await fetch(`/api/members/${m.id}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as ApiMember | null;
      if (data) setMemberForm(memberToForm(data));
    }
  }

  async function saveMemberModal() {
    if (!memberModal) return;
    setMemberSaving(true);
    setMemberModalError("");
    try {
      const credits = Number.parseInt(memberForm.remainingCredits, 10);
      if (Number.isNaN(credits) || credits < 0) {
        setMemberModalError("Credits harus angka valid.");
        return;
      }
      if (memberModal.mode === "create") {
        const body: Record<string, unknown> = {
          fullName: memberForm.fullName || null,
          email: memberForm.email || null,
          phoneNumber: memberForm.phoneNumber || null,
          membershipType: memberForm.membershipType || null,
          membershipStatus: memberForm.membershipStatus || null,
          paymentStatus: memberForm.paymentStatus || null,
          remainingCredits: credits,
          remainingPtSessions: 0,
          homeClub: memberForm.homeClub || null,
          notes: memberForm.notes || null,
          joinDate: new Date().toISOString(),
          expiryDate: memberForm.expiryDate
            ? new Date(`${memberForm.expiryDate}T12:00:00`).toISOString()
            : null,
          isWaiverSigned: false,
          isPtMember: false,
          isActive: memberForm.isActive,
        };
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        if (redirectToLoginIfUnauthorized(res.status)) return;
        if (!res.ok) {
          setMemberModalError(data.message ?? "Gagal menambah member.");
          return;
        }
        setMemberModal(null);
        void loadMembers(keyword, memberFilterTab, page);
        return;
      }
      const body: Record<string, unknown> = {
        fullName: memberForm.fullName || null,
        email: memberForm.email || null,
        phoneNumber: memberForm.phoneNumber || null,
        membershipType: memberForm.membershipType || null,
        membershipStatus: memberForm.membershipStatus || null,
        paymentStatus: memberForm.paymentStatus || null,
        remainingCredits: credits,
        homeClub: memberForm.homeClub || null,
        notes: memberForm.notes || null,
        expiryDate: memberForm.expiryDate
          ? new Date(`${memberForm.expiryDate}T12:00:00`).toISOString()
          : null,
        isActive: memberForm.isActive,
      };
      const res = await fetch(`/api/members/${memberModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (!res.ok) {
        setMemberModalError(data.message ?? "Gagal memperbarui member.");
        return;
      }
      setMemberModal(null);
      void loadMembers(keyword, memberFilterTab, page);
    } finally {
      setMemberSaving(false);
    }
  }

  function exportCsv() {
    const header = [
      "ID",
      "Member Name",
      "Current Plan",
      "Home Club",
      "Credits",
      "Status",
      "Payment",
    ];
    const rows = displayMembers.map((m) => [
      m.memberCode || m.id,
      m.fullName || "-",
      m.membershipType || "-",
      m.homeClub || "-",
      String(m.remainingCredits ?? 0),
      m.membershipStatus || "-",
      m.paymentStatus || "-",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
        <div className="flex gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setMemberFilterTab("all");
              setPage(1);
            }}
            className={`text-sm font-bold pb-2 transition border-b-2 ${
              memberFilterTab === "all"
                ? "border-sweat text-sweat"
                : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            All Data Member
          </button>
          <button
            type="button"
            onClick={() => {
              setMemberFilterTab("active");
              setPage(1);
            }}
            className={`text-sm font-bold pb-2 transition border-b-2 ${
              memberFilterTab === "active"
                ? "border-sweat text-sweat"
                : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            Active Member
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:flex-wrap">
          <button
            type="button"
            onClick={() => {
              setMemberModalError("");
              setMemberForm(emptyMemberForm());
              setMemberModal({ mode: "create" });
            }}
            className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
          >
            <i className="fas fa-user-plus" aria-hidden />
            Add new member
          </button>
          {/* Magic Search */}
          <div ref={searchWrapperRef} className="relative w-full sm:w-72">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none" aria-hidden />
              <input
                type="text"
                placeholder="Magic search member..."
                value={magicQuery}
                onChange={(e) => {
                  setMagicQuery(e.target.value);
                  if (!e.target.value) {
                    setKeyword("");
                    setPage(1);
                  }
                }}
                onFocus={() => {
                  if (magicResults.length > 0) setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setKeyword(magicQuery);
                    setShowDropdown(false);
                    setPage(1);
                  }
                  if (e.key === "Escape") {
                    setShowDropdown(false);
                  }
                }}
                className="bg-sidebar border border-border text-white pl-9 pr-4 py-2 rounded-lg text-sm w-full focus:outline-none focus:border-sweat"
              />
              {magicLoading && (
                <i className="fas fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" aria-hidden />
              )}
            </div>

            {showDropdown && magicResults.length > 0 && (
              <ul className="absolute z-50 top-full mt-1 w-full bg-sidebar border border-border rounded-lg shadow-xl overflow-hidden">
                {magicResults.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMagicResult(m);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-800 flex items-center gap-3 transition"
                    >
                      <span className="w-7 h-7 rounded-full bg-gray-700 overflow-hidden inline-block shrink-0">
                        <Image
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(m.fullName || "Member")}&background=random`}
                          alt=""
                          width={28}
                          height={28}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-white text-sm font-medium truncate">
                          {m.fullName || "-"}
                        </span>
                        <span className="block text-gray-500 text-xs truncate">
                          {m.memberCode || m.id} · {m.membershipType || "-"}
                        </span>
                      </span>
                      {m.membershipStatus && (
                        <span className={`ml-auto shrink-0 px-2 py-0.5 rounded text-xs font-bold ${statusStyle(m.membershipStatus)}`}>
                          {m.membershipStatus}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
          >
            <i className="fas fa-file-export mr-2" aria-hidden />
            Export CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm text-gray-400">
        <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
          <tr>
            {(
              [
                { label: "ID", key: "memberCode" },
                { label: "Member Name", key: "fullName" },
                { label: "Current Plan", key: "membershipType" },
                { label: "Home Club", key: "homeClub" },
                { label: "Credits", key: "remainingCredits" },
                { label: "Status", key: "membershipStatus" },
                { label: "Payment", key: "paymentStatus" },
              ] as { label: string; key: SortKey }[]
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
                      className={`fas fa-caret-up ${
                        sortKey === key && sortDir === "asc"
                          ? "text-sweat"
                          : "text-gray-600 group-hover:text-gray-400"
                      }`}
                      aria-hidden
                    />
                    <i
                      className={`fas fa-caret-down ${
                        sortKey === key && sortDir === "desc"
                          ? "text-sweat"
                          : "text-gray-600 group-hover:text-gray-400"
                      }`}
                      aria-hidden
                    />
                  </span>
                </button>
              </th>
            ))}
            <th className="px-6 py-4 text-right text-xs uppercase font-bold text-gray-500">Actions</th>
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
          ) : displayMembers.length === 0 ? (
            <tr>
              <td className="px-6 py-6 text-gray-400" colSpan={8}>
                Tidak ada data member.
              </td>
            </tr>
          ) : (
            displayMembers.map((m) => (
            <tr key={m.id} className="table-row transition">
              <td className="px-6 py-4 font-mono text-xs">
                {m.memberCode || m.id}
              </td>
              <td className="px-6 py-4 font-bold text-white">
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden inline-block shrink-0">
                    <Image
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(m.fullName || "Member")}&background=random`}
                      alt=""
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </span>
                  {m.fullName || "-"}
                </span>
              </td>
              <td className="px-6 py-4">{m.membershipType || "-"}</td>
              <td className="px-6 py-4">{m.homeClub || "-"}</td>
              <td className="px-6 py-4 font-bold text-sweat">
                {m.remainingCredits ?? 0}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-3 py-1 rounded text-xs font-bold ${statusStyle(
                    m.membershipStatus || ""
                  )}`}
                >
                  {m.membershipStatus || "-"}
                </span>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    (m.paymentStatus || "").toLowerCase() === "paid"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  {m.paymentStatus || "-"}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => void openEditMember(m)}
                  className="bg-sweat text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-400 transition inline-flex items-center gap-1.5"
                >
                  <i className="fas fa-edit" aria-hidden />
                  Edit
                </button>
              </td>
            </tr>
          )))}
        </tbody>
      </table>
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

      {memberModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMemberModal(null);
          }}
        >
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase text-white">
                {memberModal.mode === "create" ? "Add new member" : "Edit member"}
              </h3>
              <button
                type="button"
                onClick={() => setMemberModal(null)}
                className="text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Full name</span>
                <input
                  value={memberForm.fullName}
                  onChange={(e) => setMemberForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Email</span>
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Phone</span>
                <input
                  value={memberForm.phoneNumber}
                  onChange={(e) => setMemberForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Plan</span>
                  <input
                    value={memberForm.membershipType}
                    onChange={(e) => setMemberForm((f) => ({ ...f, membershipType: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Home club</span>
                  <input
                    value={memberForm.homeClub}
                    onChange={(e) => setMemberForm((f) => ({ ...f, homeClub: e.target.value }))}
                    placeholder="PIK / Puri…"
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Membership status</span>
                  <input
                    value={memberForm.membershipStatus}
                    onChange={(e) => setMemberForm((f) => ({ ...f, membershipStatus: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Payment status</span>
                  <input
                    value={memberForm.paymentStatus}
                    onChange={(e) => setMemberForm((f) => ({ ...f, paymentStatus: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Credits</span>
                  <input
                    type="number"
                    min={0}
                    value={memberForm.remainingCredits}
                    onChange={(e) => setMemberForm((f) => ({ ...f, remainingCredits: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500 text-xs uppercase font-bold">Expiry date</span>
                  <input
                    type="date"
                    value={memberForm.expiryDate}
                    onChange={(e) => setMemberForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Notes</span>
                <textarea
                  value={memberForm.notes}
                  onChange={(e) => setMemberForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat resize-y"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={memberForm.isActive}
                  onChange={(e) => setMemberForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-gray-300">Active member</span>
              </label>
            </div>
            {memberModalError && <p className="mt-3 text-xs text-red-400">{memberModalError}</p>}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={memberSaving}
                onClick={() => void saveMemberModal()}
                className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
              >
                {memberSaving ? "Menyimpan…" : memberModal.mode === "create" ? "Create member" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setMemberModal(null)}
                className="px-4 py-2 rounded-lg text-sm border border-border text-gray-300 hover:text-white"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
