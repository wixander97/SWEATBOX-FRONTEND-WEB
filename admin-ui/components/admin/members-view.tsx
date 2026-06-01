"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

type FilterTab = "all" | "active";
type SortKey = keyof ApiMember;
type SortDir = "asc" | "desc";

type ApiMember = {
  id: string;
  memberCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  membershipPlanId?: string | null;
  membershipPlanName?: string | null;
  membershipStatus?: string | null;
  paymentStatus?: string | null;
  remainingCredits?: number;
  remainingPtSessions?: number;
  joinDate?: string | null;
  expiryDate?: string | null;
  freezeStartDate?: string | null;
  freezeEndDate?: string | null;
  homeClubBranchId?: string | null;
  homeClubBranchName?: string | null;
  membershipSource?: string | null;
  address?: string | null;
  city?: string | null;
  heightCm?: number;
  weightKg?: number;
  profileImageUrl?: string | null;
  notes?: string | null;
  isWaiverSigned?: boolean;
  isPtMember?: boolean;
  isExpired?: boolean;
  isActive?: boolean;
};

type Branch = {
  id: string;
  branchName: string;
  isActive: boolean;
};

type MembershipPlan = {
  id: string;
  planName: string;
  description?: string | null;
  price?: number;
  credits: number;
  validityDays: number;
  isActive: boolean;
};

type MemberFormState = {
  // Basic Info
  fullName: string;
  phoneNumber: string;
  // Personal
  gender: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  address: string;
  city: string;
  // Emergency
  emergencyContactName: string;
  emergencyContactPhone: string;
  // Membership
  membershipSource: string;
  remainingCredits: string;
  remainingPtSessions: string;
  expiryDate: string;
  homeClubBranchId: string;
  membershipPlanId: string;
  membershipStatus: string;
  // Account Status
  profileImageUrl: string;
  notes: string;
  isWaiverSigned: boolean;
  isPtMember: boolean;
};

function emptyMemberForm(): MemberFormState {
  return {
    fullName: "",
    phoneNumber: "",
    // Personal
    gender: "",
    dateOfBirth: "",
    heightCm: "",
    weightKg: "",
    address: "",
    city: "",
    // Emergency
    emergencyContactName: "",
    emergencyContactPhone: "",
    // Membership
    membershipSource: "",
    remainingCredits: "0",
    remainingPtSessions: "0",
    expiryDate: "",
    homeClubBranchId: "",
    membershipPlanId: "",
    membershipStatus: "",
    // Account Status
    profileImageUrl: "",
    notes: "",
    isWaiverSigned: false,
    isPtMember: false,
  };
}

function parseDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function memberToForm(m: ApiMember): MemberFormState {
  return {
    fullName: m.fullName ?? "",
    phoneNumber: m.phoneNumber ?? "",
    // Personal
    gender: m.gender ?? "",
    dateOfBirth: parseDate(m.dateOfBirth),
    heightCm: String(m.heightCm ?? ""),
    weightKg: String(m.weightKg ?? ""),
    address: m.address ?? "",
    city: m.city ?? "",
    // Emergency
    emergencyContactName: m.emergencyContactName ?? "",
    emergencyContactPhone: m.emergencyContactPhone ?? "",
    // Membership
    membershipSource: m.membershipSource ?? "",
    remainingCredits: String(m.remainingCredits ?? 0),
    remainingPtSessions: String(m.remainingPtSessions ?? 0),
    expiryDate: parseDate(m.expiryDate),
    homeClubBranchId: m.homeClubBranchId ?? "",
    membershipPlanId: m.membershipPlanId ?? "",
    membershipStatus: m.membershipStatus ?? "",
    // Account Status
    profileImageUrl: m.profileImageUrl ?? "",
    notes: m.notes ?? "",
    isWaiverSigned: m.isWaiverSigned ?? false,
    isPtMember: m.isPtMember ?? false,
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
      const params = new URLSearchParams({
        search: q,
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (tab === "active") {
        params.set("isActive", "true");
      }

      const res = await authFetch(`${API_BASE_URL}/api/v1/members?${params.toString()}`, {
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
        const res = await fetch(
          `${API_BASE_URL}/api/v1/members/search?keyword=${encodeURIComponent(magicQuery)}`,
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
    setImagePreview(m.profileImageUrl || null);
    setMemberForm(memberToForm(m));
    setMemberModal({ mode: "edit", id: m.id });
    const res = await authFetch(`${API_BASE_URL}/api/v1/members/${m.id}`, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as ApiMember | null;
      if (data) {
        setMemberForm(memberToForm(data));
        setImagePreview(data.profileImageUrl || null);
      }
    }
  }

  function dateToIso(dateStr: string): string | null {
    if (!dateStr) return null;
    // If it's YYYY-MM-DD from date input, convert to full ISO format with time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = new Date(dateStr + "T00:00:00.000Z");
      return d.toISOString();
    }
    // If it's already ISO string, return as is
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function parseIntSafe(val: string): number {
    const n = Number.parseInt(val, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function calculateExpiryDate(validityDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + validityDays);
    return date.toISOString().slice(0, 10);
  }

  function handleMembershipPlanChange(planId: string) {
    const plan = membershipPlans.find((p) => p.id === planId);
    setMemberForm((f) => ({
      ...f,
      membershipPlanId: planId,
      remainingCredits: plan ? String(plan.credits) : f.remainingCredits,
      expiryDate: plan ? calculateExpiryDate(plan.validityDays) : f.expiryDate,
    }));
  }

  function generateMemberCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MBR - ${timestamp} - ${random}`;
  }

  async function saveMemberModal() {
    if (!memberModal) return;
    setMemberSaving(true);
    setMemberModalError("");
    try {
      console.log("[DEBUG] memberForm state:", JSON.stringify(memberForm, null, 2));
      const credits = parseIntSafe(memberForm.remainingCredits);
      const ptSessions = parseIntSafe(memberForm.remainingPtSessions);
      const heightCm = parseIntSafe(memberForm.heightCm);
      const weightKg = parseIntSafe(memberForm.weightKg);

      if (memberModal.mode === "create") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { ...formData } = memberForm;
        const body: Record<string, unknown> = {
          // memberCode: generateMemberCode(), // TEMP: commented out, not required
          fullName: formData.fullName || null,
          phoneNumber: formData.phoneNumber || null,
          gender: formData.gender || null,
          dateOfBirth: dateToIso(formData.dateOfBirth),
          emergencyContactName: formData.emergencyContactName || null,
          emergencyContactPhone: formData.emergencyContactPhone || null,
          membershipSource: formData.membershipSource || null,
          remainingCredits: parseIntSafe(formData.remainingCredits),
          remainingPtSessions: parseIntSafe(formData.remainingPtSessions),
          expiryDate: dateToIso(formData.expiryDate),
          homeClubBranchId: formData.homeClubBranchId || null,
          membershipPlanId: formData.membershipPlanId || null,
          address: formData.address || null,
          city: formData.city || null,
          heightCm: parseIntSafe(formData.heightCm),
          weightKg: parseIntSafe(formData.weightKg),
          profileImageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.fullName || "Member")}&background=random&size=200`,
          notes: formData.notes || null,
          isWaiverSigned: formData.isWaiverSigned,
          isPtMember: formData.isPtMember,
        };
        console.log("[DEBUG] POST body:", JSON.stringify(body, null, 2));
        const res = await authFetch(`${API_BASE_URL}/api/v1/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: unknown };
        console.log("[DEBUG] POST response:", res.status, data);
        if (redirectToLoginIfUnauthorized(res.status)) return;
        if (!res.ok) {
          let errorMsg = data?.message ?? "Gagal menambah member.";
          // Handle ASP.NET Core validation errors format
          if (data?.errors && typeof data.errors === "object") {
            const errObj = data.errors as Record<string, string[]>;
            const fieldErrors = Object.entries(errObj)
              .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
              .join("; ");
            if (fieldErrors) errorMsg = fieldErrors;
          }
          setMemberModalError(errorMsg);
          return;
        }
        setMemberModal(null);
        void loadMembers(keyword, memberFilterTab, page);
        return;
      }
      // Edit mode
      const body: Record<string, unknown> = {
        fullName: memberForm.fullName || null,
        phoneNumber: memberForm.phoneNumber || null,
        gender: memberForm.gender || null,
        dateOfBirth: dateToIso(memberForm.dateOfBirth),
        emergencyContactName: memberForm.emergencyContactName || null,
        emergencyContactPhone: memberForm.emergencyContactPhone || null,
        membershipSource: memberForm.membershipSource || null,
        remainingCredits: credits,
        remainingPtSessions: ptSessions,
        expiryDate: dateToIso(memberForm.expiryDate),
        homeClubBranchId: memberForm.homeClubBranchId || null,
        address: memberForm.address || null,
        city: memberForm.city || null,
        heightCm,
        weightKg,
        profileImageUrl: memberForm.profileImageUrl || null,
        notes: memberForm.notes || null,
        isWaiverSigned: memberForm.isWaiverSigned,
        isPtMember: memberForm.isPtMember,
      };
      const res = await authFetch(`${API_BASE_URL}/api/v1/members/${memberModal.id}`, {
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
      m.membershipPlanName || "-",
      m.homeClubBranchName || "-",
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
          <button
            type="button"
            onClick={() => {
              setMemberModalError("");
              setImagePreview(null);
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
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-4 text-sm">
              {/* Section 1: Account Information */}


              {/* Section 2: Basic Information */}
              <div className="border-b border-border pb-4">
                <h4 className="text-xs uppercase font-bold text-sweat mb-3">Basic Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Full Name <span className="text-red-500">*</span></span>
                    <input
                      value={memberForm.fullName}
                      onChange={(e) => {
                        console.log("[DEBUG] fullName onChange:", e.target.value);
                        setMemberForm((f) => ({ ...f, fullName: e.target.value }));
                      }}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>

                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Phone Number</span>
                    <input
                      value={memberForm.phoneNumber}
                      onChange={(e) => setMemberForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>
                </div>
              </div>

              {/* Section 3: Personal Details */}
              <div className="border-b border-border pb-4">
                <h4 className="text-xs uppercase font-bold text-sweat mb-3">Personal Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Gender</span>
                    <select
                      value={memberForm.gender}
                      onChange={(e) => setMemberForm((f) => ({ ...f, gender: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Date of Birth</span>
                    <input
                      type="date"
                      value={memberForm.dateOfBirth}
                      onChange={(e) => setMemberForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                      style={{ colorScheme: 'dark' }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Height (cm)</span>
                    <input
                      type="number"
                      min={0}
                      value={memberForm.heightCm}
                      onChange={(e) => setMemberForm((f) => ({ ...f, heightCm: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Weight (kg)</span>
                    <input
                      type="number"
                      min={0}
                      value={memberForm.weightKg}
                      onChange={(e) => setMemberForm((f) => ({ ...f, weightKg: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>
                </div>
              </div>

              {/* Section 4: Address */}
              <div className="border-b border-border pb-4">
                <h4 className="text-xs uppercase font-bold text-sweat mb-3">Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Address</span>
                    <textarea
                      value={memberForm.address}
                      onChange={(e) => setMemberForm((f) => ({ ...f, address: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat resize-y"
                    />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">City</span>
                    <input
                      value={memberForm.city}
                      onChange={(e) => setMemberForm((f) => ({ ...f, city: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>
                </div>
              </div>

              {/* Section 5: Emergency Contact */}
              <div className="border-b border-border pb-4">
                <h4 className="text-xs uppercase font-bold text-sweat mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Emergency Contact Name</span>
                    <input
                      value={memberForm.emergencyContactName}
                      onChange={(e) => setMemberForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Emergency Contact Phone</span>
                    <input
                      value={memberForm.emergencyContactPhone}
                      onChange={(e) => setMemberForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>
                </div>
              </div>

              {/* Section 6: Membership Details */}
              <div className="border-b border-border pb-4">
                <h4 className="text-xs uppercase font-bold text-sweat mb-3">Membership Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Membership Source</span>
                    <input
                      value={memberForm.membershipSource}
                      onChange={(e) => setMemberForm((f) => ({ ...f, membershipSource: e.target.value }))}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat"
                    />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Home Club</span>
                    <select
                      value={memberForm.homeClubBranchId}
                      onChange={(e) => setMemberForm((f) => ({ ...f, homeClubBranchId: e.target.value }))}
                      disabled={branchesLoading}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat disabled:opacity-50"
                    >
                      <option value="">{branchesLoading ? "Memuat Home Club..." : "Pilih Home Club..."}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branchName}
                        </option>
                      ))}
                      {!branchesLoading && branches.length === 0 && (
                        <option value="" disabled>Tidak ada branch aktif</option>
                      )}
                      {!branchesLoading && memberForm.homeClubBranchId && !branches.find((b) => b.id === memberForm.homeClubBranchId) && (
                        <option value={memberForm.homeClubBranchId} disabled>
                          ⚠️ Branch tidak ditemukan (ID: {memberForm.homeClubBranchId})
                        </option>
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Membership Plan</span>
                    <select
                      value={memberForm.membershipPlanId}
                      onChange={(e) => handleMembershipPlanChange(e.target.value)}
                      disabled={membershipPlansLoading}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat disabled:opacity-50"
                    >
                      <option value="">{membershipPlansLoading ? "Memuat plan..." : "Pilih Membership Plan..."}</option>
                      {membershipPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.planName} ({p.credits} credits)
                        </option>
                      ))}
                      {!membershipPlansLoading && membershipPlans.length === 0 && (
                        <option value="" disabled>Tidak ada plan aktif</option>
                      )}
                      {!membershipPlansLoading && memberForm.membershipPlanId && !membershipPlans.find((p) => p.id === memberForm.membershipPlanId) && (
                        <option value={memberForm.membershipPlanId} disabled>
                          ⚠️ Plan tidak ditemukan (ID: {memberForm.membershipPlanId})
                        </option>
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Remaining Credits</span>
                    <input
                      type="number"
                      min={0}
                      value={memberForm.remainingCredits}
                      readOnly
                      className="mt-1 w-full bg-gray-800 border border-border rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed"
                    />
                  </label>
                </div>
              </div>



              {/* Section 8: Account Status */}
              <div>
                <h4 className="text-xs uppercase font-bold text-sweat mb-3">Account Status</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberForm.isWaiverSigned}
                      onChange={(e) => setMemberForm((f) => ({ ...f, isWaiverSigned: e.target.checked }))}
                      className="rounded border-border"
                    />
                    <span className="text-gray-300">Waiver Signed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberForm.isPtMember}
                      onChange={(e) => setMemberForm((f) => ({ ...f, isPtMember: e.target.checked }))}
                      className="rounded border-border"
                    />
                    <span className="text-gray-300">PT Member</span>
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-xs uppercase font-bold">Notes</span>
                    <textarea
                      value={memberForm.notes}
                      onChange={(e) => setMemberForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat resize-y"
                    />
                  </label>
                </div>
              </div>
            </div>
            {memberModalError && <p className="mt-3 text-xs text-red-400">{memberModalError}</p>}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={memberSaving}
                onClick={() => void saveMemberModal()}
                className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
              >
                {memberSaving ? "Menyimpan..." : memberModal.mode === "create" ? "Create member" : "Save changes"}
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
