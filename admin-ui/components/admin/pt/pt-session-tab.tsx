"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import {
  CreatePtSessionModal,
  type PtSessionFormValues,
} from "@/components/admin/pt/create-pt-session-modal";
import { AddPtSessionParticipantModal } from "@/components/admin/pt/add-pt-session-participant-modal";
import { CancelPtSessionModal } from "@/components/admin/pt/cancel-pt-session-modal";
import { PtSessionDetailModal } from "@/components/admin/pt/pt-session-detail-modal";
import {
  type Coach,
  type Branch,
  type Member,
  type PtPackage,
  type PtSession,
  branchLabel,
  coachLabel,
  formatDateTime,
  formatTime,
  parseList,
  parseTotal,
  type PagedResponse,
} from "@/components/admin/pt/pt-types";

export function PtSessionTab() {
  const [sessions, setSessions] = useState<PtSession[]>([]);
  const [packages, setPackages] = useState<PtPackage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addMemberTarget, setAddMemberTarget] = useState<PtSession | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PtSession | null>(null);
  const [detailTarget, setDetailTarget] = useState<PtSession | null>(null);

  const loadSessions = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/pt-sessions?${params.toString()}`,
          { cache: "no-store" }
        );
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => [])) as
          | PtSession[]
          | PagedResponse<PtSession>;
        if (!res.ok) {
          const msg =
            typeof payload === "object" && !Array.isArray(payload)
              ? payload.message
              : "Gagal mengambil PT sessions";
          setError(msg || "Gagal mengambil PT sessions");
          setSessions([]);
          setTotalItems(0);
          setTotalPages(1);
          return;
        }
        const list = parseList(payload);
        const { totalItems: ti, totalPages: tp } = parseTotal(payload, list, pageSize);
        setSessions(list);
        setTotalItems(ti);
        setTotalPages(tp);
      } catch {
        setError("Gagal mengambil PT sessions");
        setSessions([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  const loadReferenceData = useCallback(async () => {
    const settle = async <T,>(
      run: () => Promise<Response>,
      onOk: (res: Response) => Promise<void>
    ) => {
      try {
        const res = await run();
        if (redirectToLoginIfUnauthorized(res.status)) return;
        if (res.ok) await onOk(res);
      } catch {
        // ignore — reference dropdown stays partial
      }
    };
    await Promise.all([
      settle(
        () => authFetch(`${API_BASE_URL}/api/PTPackages?page=1&pageSize=1000`, { cache: "no-store" }),
        async (res) => setPackages(parseList(await res.json().catch(() => [])))
      ),
      settle(
        () => authFetch(`${API_BASE_URL}/api/v1/coaches?page=1&pageSize=100`, { cache: "no-store" }),
        async (res) => setCoaches(parseList(await res.json().catch(() => [])))
      ),
      settle(
        () => authFetch(`${API_BASE_URL}/api/v1/branches?page=1&pageSize=100`, { cache: "no-store" }),
        async (res) => setBranches(parseList(await res.json().catch(() => [])))
      ),
      settle(
        () => authFetch(`${API_BASE_URL}/api/v1/members?page=1&pageSize=1000`, { cache: "no-store" }),
        async (res) => setMembers(parseList(await res.json().catch(() => [])))
      ),
    ]);
  }, []);

  useEffect(() => {
    void loadSessions(page);
  }, [loadSessions, page]);
  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  const coachOptions = useMemo(
    () => coaches.map((c) => ({ id: c.id, label: coachLabel(c) })),
    [coaches]
  );
  const branchOptions = useMemo(
    () => branches.map((b) => ({ id: b.id, label: branchLabel(b) })),
    [branches]
  );
  const memberOptions = useMemo(
    () => members.map((m) => ({ id: m.id, label: m.fullName || m.name || m.memberCode || m.id })),
    [members]
  );

  function coachName(id?: string | null): string {
    if (!id) return "-";
    const found = coaches.find((c) => c.id === id);
    return found ? coachLabel(found) : id;
  }
  function branchName(id?: string | null): string {
    if (!id) return "-";
    const found = branches.find((b) => b.id === id);
    return found ? branchLabel(found) : id;
  }
  function participantCount(s: PtSession): number {
    if (typeof s.participantCount === "number") return s.participantCount;
    return Array.isArray(s.participants) ? s.participants.length : 0;
  }

  function isGroup(s: PtSession): boolean {
    return String(s.trainingType ?? "").toLowerCase() === "group";
  }

  function isCancelled(s: PtSession): boolean {
    if (s.isCancelled === true) return true;
    const status = String(s.status ?? "").toLowerCase();
    return status === "cancelled" || status === "canceled";
  }

  async function handleCreate(values: PtSessionFormValues) {
    setSaving(true);
    setError("");
    try {
      const body = {
        ptPackageId: values.ptPackageId,
        memberIds: values.memberIds,
        coachId: values.coachId,
        branchId: values.branchId,
        sessionDate: values.sessionDate,
        startTime: values.startTime,
        endTime: values.endTime,
        trainingType: values.trainingType,
        maxParticipants: values.maxParticipants,
        notes: values.notes,
      };
      const res = await authFetch(`${API_BASE_URL}/api/v1/pt-sessions`, {
        method: "POST",
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message ?? "Gagal membuat PT session");
      }
      setCreateOpen(false);
      void loadSessions(page);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(session: PtSession, memberId: string) {
    setError("");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/pt-sessions/${session.id}/participants`,
        {
          method: "POST",
          body: JSON.stringify({ memberId }),
          cache: "no-store",
        }
      );
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data?.message ?? "Gagal menambahkan member");
        setAddMemberTarget(null);
        return;
      }
      setAddMemberTarget(null);
      void loadSessions(page);
    } catch {
      setError("Gagal menambahkan member");
      setAddMemberTarget(null);
    }
  }

  async function handleCancel(session: PtSession, reason: string) {
    const url = new URL(`${API_BASE_URL}/api/v1/pt-sessions/${session.id}/cancel`);
    if (reason.trim()) url.searchParams.set("reason", reason.trim());
    const res = await authFetch(url.toString(), {
      method: "POST",
      cache: "no-store",
    });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data?.message ?? "Gagal membatalkan PT session");
    }
    setCancelTarget(null);
    void loadSessions(page);
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-display font-bold text-white">PT Sessions</h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <i className="fas fa-plus" aria-hidden /> Create Session
        </button>
      </div>

      {error && (
        <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
            <tr>
              <th className="px-4 py-3">Coach</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-center">Max</th>
              <th className="px-4 py-3 text-center">Participants</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada PT session.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-gray-300">
                    {s.coachName || coachName(s.coachId)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {s.branchName || branchName(s.branchId)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{formatDateTime(s.sessionDate)}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {formatTime(s.startTime)} - {formatTime(s.endTime)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isGroup(s)
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-purple-500/15 text-purple-400"
                      }`}
                    >
                      {s.trainingType || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">
                    {s.maxParticipants ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">
                    {participantCount(s)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isCancelled(s)
                          ? "bg-red-500/15 text-red-400"
                          : "bg-green-500/15 text-green-400"
                      }`}
                    >
                      {isCancelled(s) ? "Cancelled" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      title="View Detail"
                      onClick={() => setDetailTarget(s)}
                      className="text-gray-400 hover:text-white mx-1"
                    >
                      <i className="fas fa-eye" aria-hidden />
                    </button>
                    {isGroup(s) && !isCancelled(s) && (
                      <button
                        type="button"
                        title="Add Member"
                        onClick={() => setAddMemberTarget(s)}
                        className="text-gray-400 hover:text-white mx-1"
                      >
                        <i className="fas fa-user-plus" aria-hidden />
                      </button>
                    )}
                    {!isCancelled(s) && (
                      <button
                        type="button"
                        title="Cancel Session"
                        onClick={() => setCancelTarget(s)}
                        className="text-red-500 hover:text-red-400 mx-1"
                      >
                        <i className="fas fa-ban" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500">Total {totalItems} item</span>
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
        <CreatePtSessionModal
          packages={packages}
          coachOptions={coachOptions}
          branchOptions={branchOptions}
          memberOptions={memberOptions}
          saving={saving}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {addMemberTarget && (
        <AddPtSessionParticipantModal
          memberOptions={memberOptions}
          onClose={() => setAddMemberTarget(null)}
          onSubmit={async (memberId) => {
            await handleAddMember(addMemberTarget, memberId);
          }}
        />
      )}

      {cancelTarget && (
        <CancelPtSessionModal
          onClose={() => setCancelTarget(null)}
          onSubmit={async (reason) => {
            await handleCancel(cancelTarget, reason);
          }}
        />
      )}

      {detailTarget && (
        <PtSessionDetailModal
          session={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}
