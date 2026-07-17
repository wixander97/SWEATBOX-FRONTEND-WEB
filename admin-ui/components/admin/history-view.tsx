"use client";

import { useCallback, useEffect, useState } from "react";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { downloadXlsx } from "@/lib/export";
import { SearchableSelect } from "@/components/ui/searchable-select";

type HistoryTab = "coaches" | "members";

type Coach = {
  id: string;
  fullName?: string | null;
};

type Member = {
  id: string;
  fullName?: string | null;
};

type CoachAttendanceRecord = {
  classDate: string;
  className: string;
  branchName?: string | null;
  isPresent: boolean;
  status: string;
};

type MemberBookingRecord = {
  id: string;
  memberId: string;
  memberName: string;
  classScheduleId: string;
  className: string;
  coachName: string;
  classDate: string;
  startTime: string;
  endTime: string;
  bookingDate: string;
  bookingStatus: string;
  isCancelled: boolean;
};

// Skeleton Components
function DropdownSkeleton() {
  return (
    <div className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 animate-pulse">
      <div className="h-5 bg-gray-700/50 rounded" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Class Name</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3 text-center">Present</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-3/4" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-2/3" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-1/2" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-8 mx-auto" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 bg-gray-700/50 rounded w-20" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookingTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
          <tr>
            <th className="px-4 py-3">Class Name</th>
            <th className="px-4 py-3">Coach</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Booked On</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-3/4" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-2/3" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-1/2" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-1/3" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-gray-700/50 rounded w-2/3" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 bg-gray-700/50 rounded w-20" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryView() {
  const [activeTab, setActiveTab] = useState<HistoryTab>("coaches");

  // Coach tab state
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [attendanceHistory, setAttendanceHistory] = useState<CoachAttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");

  // Member tab state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [bookingHistory, setBookingHistory] = useState<MemberBookingRecord[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  // Load coaches list
  const loadCoaches = useCallback(async () => {
    setCoachesLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/coaches?page=1&pageSize=1000`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (res.ok) {
        const payload = await res.json();
        const list = Array.isArray(payload) ? payload : (payload.items ?? payload.data ?? []);
        setCoaches(list);
      }
    } catch {
      // ignore
    } finally {
      setCoachesLoading(false);
    }
  }, []);

  // Load members list
  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/members?page=1&pageSize=1000`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (res.ok) {
        const payload = await res.json();
        const list = Array.isArray(payload) ? payload : (payload.items ?? payload.data ?? []);
        setMembers(list);
      }
    } catch {
      // ignore
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // Load coach attendance history
  const loadAttendanceHistory = useCallback(async (coachId: string) => {
    if (!coachId) return;
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
  }, []);

  // Load member booking history
  const loadBookingHistory = useCallback(async (memberId: string) => {
    if (!memberId) return;
    setBookingLoading(true);
    setBookingError("");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/class-bookings/member/${memberId}/history`,
        { cache: "no-store" }
      );
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (res.ok) {
        const payload = await res.json();
        const list = Array.isArray(payload) ? payload : (payload.items ?? payload.data ?? []);
        setBookingHistory(list);
      } else {
        setBookingError("Failed to load booking history");
        setBookingHistory([]);
      }
    } catch {
      setBookingError("Failed to load booking history");
      setBookingHistory([]);
    } finally {
      setBookingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoaches();
    void loadMembers();
  }, [loadCoaches, loadMembers]);

  useEffect(() => {
    if (selectedCoachId) {
      void loadAttendanceHistory(selectedCoachId);
    } else {
      setAttendanceHistory([]);
    }
  }, [selectedCoachId, loadAttendanceHistory]);

  useEffect(() => {
    if (selectedMemberId) {
      void loadBookingHistory(selectedMemberId);
    } else {
      setBookingHistory([]);
    }
  }, [selectedMemberId, loadBookingHistory]);

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  function formatClassDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  function formatTimeRange(startTime: string, endTime: string): string {
    try {
      const start = startTime.substring(0, 5); // HH:MM
      const end = endTime.substring(0, 5); // HH:MM
      return `${start} - ${end}`;
    } catch {
      return `${startTime} - ${endTime}`;
    }
  }

  async function exportCoachAttendanceXlsx() {
    if (!selectedCoachId || attendanceHistory.length === 0) return;
    const header = ["Date", "Class Name", "Branch", "Present", "Status"];
    const rows = attendanceHistory.map((r) => [
      formatDate(r.classDate),
      r.className,
      r.branchName || "-",
      r.isPresent ? "Yes" : "No",
      r.status,
    ]);
    await downloadXlsx([header, ...rows], "coach-attendance.xlsx");
  }

  async function exportMemberBookingXlsx() {
    if (!selectedMemberId || bookingHistory.length === 0) return;
    const header = ["Class Name", "Coach", "Date", "Time", "Booked On", "Status"];
    const rows = bookingHistory.map((r) => [
      r.className,
      r.coachName || "-",
      formatClassDate(r.classDate),
      formatTimeRange(r.startTime, r.endTime),
      formatDate(r.bookingDate),
      r.isCancelled ? "Cancelled" : r.bookingStatus,
    ]);
    await downloadXlsx([header, ...rows], "member-booking.xlsx");
  }

  const coachExportDisabled =
    !selectedCoachId || attendanceLoading || !!attendanceError || attendanceHistory.length === 0;
  const memberExportDisabled =
    !selectedMemberId || bookingLoading || !!bookingError || bookingHistory.length === 0;

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("coaches")}
          className={`px-4 py-3 text-sm font-bold transition border-b-2 ${activeTab === "coaches"
              ? "border-sweat text-sweat"
              : "border-transparent text-gray-500 hover:text-white"
            }`}
        >
          Coach Attendance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`px-4 py-3 text-sm font-bold transition border-b-2 ${activeTab === "members"
              ? "border-sweat text-sweat"
              : "border-transparent text-gray-500 hover:text-white"
            }`}
        >
          Member Booking
        </button>
      </div>

      {/* Coach Attendance Tab */}
      {activeTab === "coaches" && (
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h4 className="text-lg font-bold">Coach Attendance History</h4>
            <button
              type="button"
              onClick={() => void exportCoachAttendanceXlsx()}
              disabled={coachExportDisabled}
              title="Export attendance history to XLSX"
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-file-export mr-2" aria-hidden />
              Export
            </button>
          </div>

          {/* Coach Selector */}
          <div className="mb-6">
            <label className="block text-xs uppercase font-bold text-gray-500 mb-2">
              Select Coach
            </label>
            <SearchableSelect
              options={coaches}
              value={selectedCoachId || null}
              onChange={(value) => setSelectedCoachId(value || "")}
              getOptionValue={(coach) => coach.id}
              getOptionLabel={(coach) => coach.fullName || "Unnamed Coach"}
              placeholder="Search and select a coach..."
              loading={coachesLoading}
              emptyText="No coaches found"
            />
          </div>

          {/* Attendance History Table */}
          {!selectedCoachId && !coachesLoading ? (
            <div className="text-center py-12">
              <i className="fas fa-user-clock text-gray-600 text-5xl mb-4" aria-hidden />
              <h5 className="text-lg font-bold text-gray-400 mb-2">Select a Coach</h5>
              <p className="text-sm text-gray-500">
                Choose a coach from the dropdown above to view their attendance history
              </p>
            </div>
          ) : selectedCoachId && attendanceLoading ? (
            <TableSkeleton rows={6} />
          ) : selectedCoachId && attendanceError ? (
            <div className="text-center py-12">
              <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-4" aria-hidden />
              <h5 className="text-lg font-bold text-red-400 mb-2">Error Loading History</h5>
              <p className="text-sm text-gray-500">{attendanceError}</p>
            </div>
          ) : selectedCoachId && attendanceHistory.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-calendar-times text-gray-600 text-5xl mb-4" aria-hidden />
              <h5 className="text-lg font-bold text-gray-400 mb-2">No Attendance History</h5>
              <p className="text-sm text-gray-500">
                This coach has no attendance records yet
              </p>
            </div>
          ) : selectedCoachId ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm text-gray-400">
                <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Class Name</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3 text-center">Present</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendanceHistory.map((record, idx) => (
                    <tr key={idx} className="transition hover:bg-white/5">
                      <td className="px-4 py-3 text-white">{formatDate(record.classDate)}</td>
                      <td className="px-4 py-3">{record.className}</td>
                      <td className="px-4 py-3">{record.branchName || "—"}</td>
                      <td className="px-4 py-3 text-center">
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
                      <td className="px-4 py-3">
                        <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/20">
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {/* Member Booking Tab */}
      {activeTab === "members" && (
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h4 className="text-lg font-bold">Member Booking History</h4>
            <button
              type="button"
              onClick={() => void exportMemberBookingXlsx()}
              disabled={memberExportDisabled}
              title="Export booking history to XLSX"
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-file-export mr-2" aria-hidden />
              Export
            </button>
          </div>

          {/* Member Selector */}
          <div className="mb-6">
            <label className="block text-xs uppercase font-bold text-gray-500 mb-2">
              Select Member
            </label>
            <SearchableSelect
              options={members}
              value={selectedMemberId || null}
              onChange={(value) => setSelectedMemberId(value || "")}
              getOptionValue={(member) => member.id}
              getOptionLabel={(member) => member.fullName || "Unnamed Member"}
              placeholder="Search and select a member..."
              loading={membersLoading}
              emptyText="No members found"
            />
          </div>

          {/* Booking History Table */}
          {!selectedMemberId && !membersLoading ? (
            <div className="text-center py-12">
              <i className="fas fa-user-clock text-gray-600 text-5xl mb-4" aria-hidden />
              <h5 className="text-lg font-bold text-gray-400 mb-2">Select a Member</h5>
              <p className="text-sm text-gray-500">
                Choose a member from the dropdown above to view their booking history
              </p>
            </div>
          ) : selectedMemberId && bookingLoading ? (
            <BookingTableSkeleton rows={6} />
          ) : selectedMemberId && bookingError ? (
            <div className="text-center py-12">
              <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-4" aria-hidden />
              <h5 className="text-lg font-bold text-red-400 mb-2">Error Loading History</h5>
              <p className="text-sm text-gray-500">{bookingError}</p>
            </div>
          ) : selectedMemberId && bookingHistory.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-calendar-times text-gray-600 text-5xl mb-4" aria-hidden />
              <h5 className="text-lg font-bold text-gray-400 mb-2">No Booking History</h5>
              <p className="text-sm text-gray-500">
                This member has no booking records yet
              </p>
            </div>
          ) : selectedMemberId ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm text-gray-400">
                <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Class Name</th>
                    <th className="px-4 py-3">Coach</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Booked On</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bookingHistory.map((record) => (
                    <tr key={record.id} className="transition hover:bg-white/5">
                      <td className="px-4 py-3 text-white">{record.className}</td>
                      <td className="px-4 py-3">{record.coachName || "—"}</td>
                      <td className="px-4 py-3">{formatClassDate(record.classDate)}</td>
                      <td className="px-4 py-3">{formatTimeRange(record.startTime, record.endTime)}</td>
                      <td className="px-4 py-3 text-white">{formatDate(record.bookingDate)}</td>
                      <td className="px-4 py-3">
                        {record.isCancelled ? (
                          <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/20">
                            Cancelled
                          </span>
                        ) : record.bookingStatus === "Attended" ? (
                          <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/20">
                            {record.bookingStatus}
                          </span>
                        ) : (
                          <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/20">
                            {record.bookingStatus}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
