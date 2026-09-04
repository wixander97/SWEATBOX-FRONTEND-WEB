"use client";

import { formatDateTime, type PtSessionParticipant } from "./pt-types";

export type ParticipantsStatus = "loading" | "loaded" | "error";

/** Resolve a participant's display name, preferring richer fields first. */
export function participantName(p: PtSessionParticipant): string {
  return p.fullName || p.memberName || p.memberCode || p.memberId || "—";
}

/**
 * Read-only list of PT session participants, sourced from
 * `GET /api/v1/pt-sessions/{id}/participants`. Shared by the detail modal and
 * the table expandable panel. The refresh control lives in each surface (next
 * to its section header); this component only renders the list body.
 */
export function ParticipantList({
  participants,
  status,
}: {
  participants: PtSessionParticipant[];
  status: ParticipantsStatus;
}) {
  if (status === "loading" && participants.length === 0) {
    return <p className="text-xs text-muted py-2">Loading participants...</p>;
  }
  if (status === "error" && participants.length === 0) {
    return <p className="text-xs text-danger py-2">Failed to load participants.</p>;
  }
  if (participants.length === 0) {
    return <p className="text-xs text-muted py-2">No participants yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {participants.map((p, i) => {
        const attended = p.isAttended === true;
        return (
          <li
            key={p.memberId ?? i}
            className="text-sm text-fg-soft flex items-center gap-2 flex-wrap"
          >
            <i className="fas fa-user text-muted text-xs" aria-hidden />
            <span>{participantName(p)}</span>
            {p.memberCode && (
              <span className="text-xs text-muted">({p.memberCode})</span>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                attended
                  ? "bg-green-500/15 text-success"
                  : "bg-gray-500/15 text-fg-soft"
              }`}
            >
              {attended ? "Attended" : "Pending"}
            </span>
            <span className="text-xs text-muted ml-auto">
              {p.checkInTime ? formatDateTime(p.checkInTime) : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}