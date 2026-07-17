"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { downloadXlsx } from "@/lib/export";
import { EditMemberModal } from "@/components/admin/members/edit-member-modal";
import {
  type ApiMember,
  type Branch,
  type MembershipPlan,
  type PagedResponse,
} from "@/components/admin/members/members.types";

type FilterTab = "all" | "active";
type SortKey = keyof ApiMember;
type SortDir = "asc" | "desc";

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

  const [memberModal, setMemberModal] = useState<
    { mode: "edit"; member: ApiMember } | null
  >(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [membershipPlansLoading, setMembershipPlansLoading] = useState(true);

  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/branches`);
        if (res.ok) {
          const data = (await res.json()) as Branch[];
          setBranches(data.filter((b) => b.isActive));
        }
      } catch {
        // silently fail, branches will be empty
      } finally {
        setBranchesLoading(false);
      }
    }
    void loadBranches();
  }, []);

  useEffect(() => {
    async function loadMembershipPlans() {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/membership-plans`);
        if (res.ok) {
          const data = (await res.json()) as MembershipPlan[];
          setMembershipPlans(data.filter((p) => p.isActive));
        }
      } catch {
        // silently fail, plans will be empty
      } finally {
        setMembershipPlansLoading(false);
      }
    }
    void loadMembershipPlans();
  }, []);

  const loadMembers = useCallback(
    async (q: string, tab: FilterTab, targetPage: number) => {
      setLoading(true);
      setError("");
      const trimmed = q.trim();
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });

      let endpoint: string;
      if (trimmed) {
        endpoint = `${API_BASE_URL}/api/v1/members/search`;
        params.set("keyword", trimmed);
      } else {
        endpoint =
          tab === "active"
            ? `${API_BASE_URL}/api/v1/members/active`
            : `${API_BASE_URL}/api/v1/members`;
        params.set("search", q);
      }
      const res = await authFetch(`${endpoint}?${params.toString()}`, {
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

  // Magic search - debounced fetch from /api/v1/members/search
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
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/members/search?keyword=${encodeURIComponent(magicQuery)}`,
          { cache: "no-store" }
        );
        if (redirectToLoginIfUnauthorized(res.status)) return;
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

  async function exportXlsx() {
    const fmtDate = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleDateString("id-ID") : "-";
    const yesNo = (v?: boolean | null) => (v ? "Yes" : "No");
    const val = (s?: string | null) => s || "-";

    const header = [
      "Member Code",
      "Full Name",
      "Email",
      "Phone Number",
      "Gender",
      "Date of Birth",
      "Emergency Contact Name",
      "Emergency Contact Phone",
      "Membership Plan",
      "Membership Status",
      "Payment Status",
      "Remaining Credits",
      "Remaining PT Sessions",
      "Join Date",
      "Expiry Date",
      "Freeze Start Date",
      "Freeze End Date",
      "Home Club",
      "Membership Source",
      "Address",
      "City",
      "Height (cm)",
      "Weight (kg)",
      "Profile Image URL",
      "Notes",
      "Waiver Signed",
      "PT Member",
      "Expired",
      "Active",
    ];
    const rows = displayMembers.map((m) => [
      val(m.memberCode),
      val(m.fullName),
      val(m.email),
      val(m.phoneNumber),
      val(m.gender),
      fmtDate(m.dateOfBirth),
      val(m.emergencyContactName),
      val(m.emergencyContactPhone),
      val(m.membershipPlanName),
      val(m.membershipStatus),
      val(m.paymentStatus),
      String(m.remainingCredits ?? 0),
      String(m.remainingPtSessions ?? 0),
      fmtDate(m.joinDate),
      fmtDate(m.expiryDate),
      fmtDate(m.freezeStartDate),
      fmtDate(m.freezeEndDate),
      val(m.homeClubBranchName),
      val(m.membershipSource),
      val(m.address),
      val(m.city),
      String(m.heightCm ?? 0),
      String(m.weightKg ?? 0),
      val(m.profileImageUrl),
      val(m.notes),
      yesNo(m.isWaiverSigned),
      yesNo(m.isPtMember),
      yesNo(m.isExpired),
      yesNo(m.isActive),
    ]);
    await downloadXlsx([header, ...rows], "members.xlsx");
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
            className={`text-sm font-bold pb-2 transition border-b-2 ${memberFilterTab === "all"
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
            className={`text-sm font-bold pb-2 transition border-b-2 ${memberFilterTab === "active"
              ? "border-sweat text-sweat"
              : "border-transparent text-gray-500 hover:text-white"
              }`}
          >
            Active Member
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:flex-wrap">
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
                required
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
                        {/* <span className="block text-gray-500 text-xs truncate">
                          {m.memberCode || m.id} · {m.membershipType || "-"}
                        </span> */}
                      </span>

                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => void exportXlsx()}
            className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
          >
            <i className="fas fa-file-export mr-2" aria-hidden />
            Export
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
                  { label: "Home Club", key: "homeClubBranchName" },
                  { label: "Membership Plan", key: "membershipPlanName" },
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
                  <td className="px-6 py-4">{m.homeClubBranchName || "—"}</td>
                  <td className="px-6 py-4">{m.membershipPlanName || "—"}</td>
                  <td className="px-6 py-4">{String(m.remainingCredits) || "-"}</td>
                  <td className="px-6 py-4 font-bold text-sweat">
                    {m.membershipStatus ?? 0}
                  </td>
                  <td className="px-6 py-4 font-bold text-sweat">
                    {m.paymentStatus ?? 0}
                  </td>


                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setMemberModal({ mode: "edit", member: m })}
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

      {memberModal?.mode === "edit" && (
        <EditMemberModal
          member={memberModal.member}
          branches={branches}
          branchesLoading={branchesLoading}
          membershipPlans={membershipPlans}
          membershipPlansLoading={membershipPlansLoading}
          onClose={() => setMemberModal(null)}
          onSuccess={() => void loadMembers(keyword, memberFilterTab, page)}
        />
      )}
    </div>
  );
}
