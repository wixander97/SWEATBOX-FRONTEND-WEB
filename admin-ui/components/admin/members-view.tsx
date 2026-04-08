"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type FilterTab = "all" | "active";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMembers = useCallback(
    async (q: string, tab: FilterTab) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        keyword: q,
        pageNumber: "1",
        pageSize: "100",
      });
      if (tab === "active") {
        params.set("membershipStatus", "Active");
      }

      const res = await fetch(`/api/members?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => [])) as
        | ApiMember[]
        | { items?: ApiMember[]; data?: ApiMember[]; message?: string };

      if (!res.ok) {
        const msg =
          typeof payload === "object" && !Array.isArray(payload)
            ? payload.message
            : "Gagal mengambil data member";
        setError(msg || "Gagal mengambil data member");
        setMembers([]);
        setLoading(false);
        return;
      }

      if (Array.isArray(payload)) {
        setMembers(payload);
      } else {
        setMembers(payload.items || payload.data || []);
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMembers(keyword, memberFilterTab);
  }, [loadMembers, keyword, memberFilterTab]);

  const displayMembers = useMemo(() => members, [members]);

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
            onClick={() => setMemberFilterTab("all")}
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
            onClick={() => setMemberFilterTab("active")}
            className={`text-sm font-bold pb-2 transition border-b-2 ${
              memberFilterTab === "active"
                ? "border-sweat text-sweat"
                : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            Active Member
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <input
            type="text"
            placeholder="Search member name..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-sweat"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadMembers(keyword, memberFilterTab)}
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
            >
              <i className="fas fa-filter mr-2" aria-hidden />
              Filter
            </button>
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
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm text-gray-400">
        <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
          <tr>
            <th className="px-6 py-4">ID</th>
            <th className="px-6 py-4">Member Name</th>
            <th className="px-6 py-4">Current Plan</th>
            <th className="px-6 py-4">Home Club</th>
            <th className="px-6 py-4">Credits</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Payment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            <tr>
              <td className="px-6 py-6 text-gray-400" colSpan={7}>
                Loading...
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td className="px-6 py-6 text-red-400" colSpan={7}>
                {error}
              </td>
            </tr>
          ) : displayMembers.length === 0 ? (
            <tr>
              <td className="px-6 py-6 text-gray-400" colSpan={7}>
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
            </tr>
          )))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
