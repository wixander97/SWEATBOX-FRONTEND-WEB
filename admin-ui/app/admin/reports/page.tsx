"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type StaffAttendance = {
  id: string;
  staffId?: string | null;
  staffName?: string | null;
  role?: string | null;
  branchName?: string | null;
  clockIn?: string | null;
  clockOut?: string | null;
  date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  selfieImageUrl?: string | null;
  notes?: string | null;
  status?: string | null;
};

type Staff = {
  id: string;
  fullName?: string | null;
  name?: string | null;
  role?: string | null;
};

type SortDir = "asc" | "desc";
type SortKey = keyof StaffAttendance;

function formatTime(val?: string | null) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(val?: string | null) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReportsPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  // Load staff list for filter dropdown
  useEffect(() => {
    fetch("/api/staffs", { cache: "no-store" })
      .then((r) => {
        if (redirectToLoginIfUnauthorized(r.status)) return;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const list: Staff[] = Array.isArray(data)
          ? data
          : (data.items ?? data.data ?? []);
        setStaffList(list);
      })
      .catch(() => {});
  }, []);

  const loadAttendances = useCallback(async (staffId: string) => {
    setLoading(true);
    setError("");
    const url = staffId
      ? `/api/staff-attendances/${staffId}`
      : "/api/staff-attendances";
    const res = await fetch(url, { cache: "no-store" });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    const data = await res.json().catch(() => []);
    if (!res.ok) {
      setError(
        typeof data === "object" && !Array.isArray(data)
          ? (data.message ?? "Gagal mengambil data attendance")
          : "Gagal mengambil data attendance"
      );
      setAttendances([]);
      setLoading(false);
      return;
    }
    const list: StaffAttendance[] = Array.isArray(data)
      ? data
      : (data.items ?? data.data ?? []);
    setAttendances(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAttendances(selectedStaffId);
  }, [loadAttendances, selectedStaffId]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return attendances;
    return [...attendances].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [attendances, sortKey, sortDir]);

  const presentCount = attendances.filter((a) => a.clockIn).length;

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="tab-btn active cursor-pointer bg-card px-6 py-4 rounded-xl border border-sweat text-sweat font-bold sm:w-1/4 text-center hover:bg-white/5">
          <i className="fas fa-id-card-alt mb-2 block text-2xl" aria-hidden />
          Staff Attendance
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h4 className="font-bold text-lg text-white">Staff Attendance Log</h4>
            {!loading && (
              <span className="text-sm text-gray-400">
                Total: {presentCount} Clock-in
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="bg-sidebar border border-border text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat min-w-[180px]"
            >
              <option value="">All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName ?? s.name ?? s.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadAttendances(selectedStaffId)}
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
            >
              <i className="fas fa-sync-alt mr-2" aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm text-gray-400">
            <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
              <tr>
                {(
                  [
                    { label: "Date", key: "date" },
                    { label: "Staff Name", key: "staffName" },
                    { label: "Role", key: "role" },
                    { label: "Location", key: "branchName" },
                    { label: "Clock In", key: "clockIn" },
                    { label: "Clock Out", key: "clockOut" },
                    { label: "Status", key: "status" },
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
                <th className="px-6 py-4">Selfie</th>
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
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-gray-400" colSpan={8}>
                    Tidak ada data attendance.
                  </td>
                </tr>
              ) : (
                sortedRows.map((s) => (
                  <tr key={s.id} className="table-row transition">
                    <td className="px-6 py-4 font-mono text-xs text-white">
                      {formatDate(s.date ?? s.clockIn)}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {s.staffName || "-"}
                    </td>
                    <td className="px-6 py-4">{s.role || "-"}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2">
                        <i className="fas fa-map-marker-alt text-xs text-sweat" aria-hidden />
                        {s.branchName || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-green-400">
                      {formatTime(s.clockIn)}
                    </td>
                    <td className="px-6 py-4 font-mono text-yellow-400">
                      {formatTime(s.clockOut)}
                    </td>
                    <td className="px-6 py-4">
                      {s.status ? (
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            s.status.toLowerCase().includes("late")
                              ? "bg-red-500/10 text-red-400"
                              : "bg-green-500/10 text-green-500 border border-green-500/20"
                          }`}
                        >
                          {s.status}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {s.selfieImageUrl ? (
                        <a
                          href={s.selfieImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 underline hover:text-blue-300"
                        >
                          View Photo
                        </a>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
