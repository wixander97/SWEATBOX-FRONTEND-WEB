"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import {
  type PtSession,
  type PtSessionParticipant,
  formatDateTime,
  formatTime,
} from "@/components/admin/pt/pt-types";
import {
  ParticipantList,
  type ParticipantsStatus,
} from "@/components/admin/pt/participant-list";

type Props = {
  session: PtSession;
  participants: PtSessionParticipant[];
  participantsStatus: ParticipantsStatus;
  onRefreshParticipants: () => void;
  onClose: () => void;
};

function statusBadge(s: PtSession): { label: string; class: string } {
  const status = String(s.status ?? "").toLowerCase();
  if (s.isCancelled === true || status === "cancelled" || status === "canceled") {
    return { label: "Cancelled", class: "bg-red-500/10 text-red-400 border-red-500/30" };
  }
  if (s.isCompleted === true || status === "completed") {
    return { label: "Completed", class: "bg-gray-500/10 text-gray-300 border-gray-500/30" };
  }
  return { label: "Active", class: "bg-green-500/10 text-green-400 border-green-500/30" };
}

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <i className={`${icon} text-sweat w-4 text-sm`} aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
        {label}
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  if (value == null) return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`text-sm text-right ${
          highlight ? "text-white font-bold text-base" : "text-gray-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function PtSessionDetailModal({
  session,
  participants,
  participantsStatus,
  onRefreshParticipants,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<PtSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/pt-sessions/${session.id}`, {
          cache: "no-store",
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          if (!cancelled) setError(data?.message ?? "Gagal memuat detail PT session.");
          return;
        }
        const data = (await res.json().catch(() => null)) as PtSession | null;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setError("Gagal memuat detail PT session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  // Use fetched detail if available, otherwise fall back to the row summary.
  const s: PtSession = detail ?? session;
  const badge = statusBadge(s);
  // Participants come from the lifted cache (GET /pt-sessions/{id}/participants).
  const participantCount = participants.length;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
                PT Session Detail
              </p>
              <p className="text-sm font-mono text-sweat font-bold">{s.id}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${badge.class}`}
              >
                {badge.label}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-1">
          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Memuat detail...</p>
          ) : error ? (
            <p className="text-sm text-red-400 py-8 text-center">{error}</p>
          ) : (
            <>
              {/* Schedule */}
              <SectionHeader icon="fas fa-calendar-alt" label="Schedule" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <Row label="Session Date" value={formatDateTime(s.sessionDate)} />
                <Row label="Start Time" value={formatTime(s.startTime)} />
                <Row label="End Time" value={formatTime(s.endTime)} />
                <Row
                  label="Training Type"
                  value={s.trainingType ?? null}
                  highlight
                />
              </div>

              {/* People & Place */}
              <SectionHeader icon="fas fa-users" label="People & Place" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <Row label="Coach" value={s.coachName ?? null} />
                <Row label="Branch" value={s.branchName ?? null} />
                <Row label="Max Participants" value={String(s.maxParticipants ?? 0)} />
                <Row label="Participants" value={String(participantCount)} />
              </div>

              {/* Participant list (lifted from GET /pt-sessions/{id}/participants) */}
              <div className="flex items-center justify-between mt-4 first:mt-0">
                <div className="flex items-center gap-2">
                  <i className="fas fa-user-friends text-sweat w-4 text-sm" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Participant List
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRefreshParticipants}
                  disabled={participantsStatus === "loading"}
                  className="text-gray-400 hover:text-white text-xs disabled:opacity-50"
                  aria-label="Refresh peserta"
                  title="Refresh peserta"
                >
                  <i className="fas fa-sync-alt" aria-hidden />
                </button>
              </div>
              <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
                <ParticipantList
                  participants={participants}
                  status={participantsStatus}
                />
              </div>

              {/* Notes */}
              {s.notes && (
                <>
                  <SectionHeader icon="fas fa-sticky-note" label="Notes" />
                  <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                      {s.notes}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-sidebar border border-border text-gray-300 px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
