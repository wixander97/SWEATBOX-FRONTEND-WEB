"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import type { ApiClass } from "@/components/admin/classes/classes.types";
import {
  activateClassSession,
  listBookingsForSchedule,
  remainingSlotsOf,
  sessionActivationBlocker,
  type ClassBooking,
} from "@/lib/api/classes";
import { errorMessageOf } from "@/lib/api/http";
import { recordManualAttendance } from "@/lib/api/attendance";
import { memberDisplayName, searchMembers, type ApiMember } from "@/lib/api/members";

type Props = {
  cls: ApiClass;
  onClose: () => void;
};

function statusBadge(c: ApiClass): { label: string; class: string } {
  if (c.isCancelled === true) {
    return { label: "Cancelled", class: "bg-red-500/10 text-danger border-red-500/30" };
  }
  if (c.isCompleted === true) {
    return { label: "Completed", class: "bg-gray-500/10 text-fg-soft border-gray-500/30" };
  }
  if (c.isActive === false) {
    return { label: "Inactive", class: "bg-gray-500/10 text-fg-soft border-gray-500/30" };
  }
  return { label: "Active", class: "bg-green-500/10 text-success border-green-500/30" };
}

function yesNo(v: boolean | undefined | null): string {
  return v ? "Yes" : "No";
}

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <i className={`${icon} text-accent-ink w-4 text-sm`} aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-muted">
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
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span
        className={`text-sm text-right ${
          highlight ? "text-fg font-bold text-base" : "text-fg-soft"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Copy a value to the clipboard.
 *
 * `navigator.clipboard` is unavailable on plain HTTP and in older kiosk
 * browsers, which is exactly where a front desk tablet tends to live, so the
 * legacy `execCommand` path stays as a fallback rather than leaving staff with
 * a button that silently does nothing.
 */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <button
      type="button"
      onClick={async () => setState((await copyText(value)) ? "copied" : "failed")}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="shrink-0 px-2 py-1 rounded border border-border text-[11px] text-muted hover:text-fg hover:border-sweat transition"
    >
      <i
        className={`fas ${state === "copied" ? "fa-check" : "fa-copy"} mr-1`}
        aria-hidden
      />
      {state === "copied" ? "Copied" : state === "failed" ? "Failed" : "Copy"}
    </button>
  );
}

/**
 * An identifier row: the full value, never truncated, plus a copy button.
 *
 * These GUIDs are working data — the manual Barcode Scanner page and every
 * backend support request need them in full — so they wrap instead of ending
 * in an ellipsis that has to be retyped from a screenshot.
 */
function IdRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-border/40 last:border-b-0">
      <div className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block text-[11px] font-mono text-fg-soft break-all select-all leading-relaxed">
          {value}
        </span>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function ClassDetailModal({ cls, onClose }: Props) {
  const [detail, setDetail] = useState<ApiClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendees, setAttendees] = useState<ClassBooking[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(true);
  const [attendeesError, setAttendeesError] = useState("");
  /** Bumped after an activation so the flags below are re-read from backend. */
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmActivate, setConfirmActivate] = useState(false);
  /** Member currently being marked present, so only that row shows a spinner. */
  const [attendingId, setAttendingId] = useState<string | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceError, setAttendanceError] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInQuery, setWalkInQuery] = useState("");
  const [walkInResults, setWalkInResults] = useState<ApiMember[]>([]);
  const [walkInSearching, setWalkInSearching] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [activateMessage, setActivateMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/class-schedules/${cls.id}`, {
          cache: "no-store",
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          if (!cancelled) setError(data?.message ?? "Failed to load class schedule details.");
          return;
        }
        const data = (await res.json().catch(() => null)) as ApiClass | null;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setError("Failed to load class schedule details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    async function loadAttendees() {
      setAttendeesLoading(true);
      setAttendeesError("");
      try {
        const list = await listBookingsForSchedule(cls.id);
        if (!cancelled) setAttendees(list);
      } catch (err) {
        if (!cancelled) {
          setAttendeesError(errorMessageOf(err, "Failed to load class participants."));
          setAttendees([]);
        }
      } finally {
        if (!cancelled) setAttendeesLoading(false);
      }
    }
    void loadDetail();
    void loadAttendees();
    return () => {
      cancelled = true;
    };
  }, [cls.id, reloadKey]);

  useEffect(() => {
    const keyword = walkInQuery.trim();
    if (!walkInOpen || keyword.length < 2) {
      setWalkInResults([]);
      return;
    }
    let cancelled = false;
    setWalkInSearching(true);
    const timer = setTimeout(() => {
      searchMembers(keyword)
        .then((list) => {
          if (!cancelled) setWalkInResults(list.slice(0, 6));
        })
        .catch(() => {
          if (!cancelled) setWalkInResults([]);
        })
        .finally(() => {
          if (!cancelled) setWalkInSearching(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [walkInQuery, walkInOpen]);

  const c: ApiClass = detail ?? cls;
  const badge = statusBadge(c);
  const enrolled =
    c.bookedCount ?? Math.max(0, c.capacity - (c.remainingSlots ?? c.capacity));
  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-GB") : null;
  const fmtDateTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-GB") : null;

  const activationBlocker = sessionActivationBlocker(c);
  /**
   * Attendance the backend will not take.
   *
   * `ManualAttendanceAsync` refuses a cancelled or completed class outright, so
   * the buttons are hidden rather than offered and rejected. Everything else it
   * checks — membership, credits, drop-in pass, capacity — is left to it.
   */
  const attendanceClosed = c.isCancelled === true || c.isCompleted === true;
  /** Booked members not yet marked present — what "Mark all present" works on. */
  const pendingAttendance = attendees.filter(
    (b) => !b.isCancelled && (b.bookingStatus ?? "").toLowerCase() !== "attended"
  );

  /**
   * Turn the session on without the coach's QR.
   *
   * Same endpoint the coach scan hits, with the ids taken from the schedule
   * itself — so this cannot be pointed at the wrong class the way retyping two
   * GUIDs into the manual scanner can. The schedule is re-read afterwards, and
   * only what the backend then reports is shown: the button never decides on
   * its own that the session is active.
   */
  async function runActivation() {
    if (activating || !c.coachId || activationBlocker) return;
    setActivating(true);
    setActivateError("");
    setActivateMessage("");
    try {
      const result = await activateClassSession({
        coachId: c.coachId,
        classScheduleId: c.id,
      });
      setActivateMessage(result?.message?.trim() || "Class session activated.");
      setConfirmActivate(false);
      setReloadKey((v) => v + 1);
    } catch (err) {
      setActivateError(errorMessageOf(err, "Failed to activate class session"));
    } finally {
      setActivating(false);
    }
  }

  /**
   * Mark a member present without their QR.
   *
   * One endpoint covers both cases the front desk has: a member who booked but
   * cannot scan, and a walk-in who never booked — the backend creates the
   * booking for the latter before recording attendance. Entitlement stays
   * entirely backend-side (a credit at the home club, a drop-in visit
   * elsewhere), and it answers 200 even when it refuses, so only its own
   * `success` flag closes the row here.
   */
  async function markPresent(
    memberId: string,
    label: string,
    memberCode?: string | null
  ) {
    if (attendingId) return;
    setAttendingId(memberId);
    setAttendanceError("");
    setAttendanceMessage("");
    try {
      const result = await recordManualAttendance({
        memberId,
        classScheduleId: c.id,
        branchId: c.branchId,
        memberCode,
      });
      if (result.success) {
        setAttendanceMessage(`${label}: ${result.message}`);
        setWalkInQuery("");
        setWalkInResults([]);
        setReloadKey((v) => v + 1);
      } else {
        setAttendanceError(`${label}: ${result.message}`);
      }
    } catch (err) {
      setAttendanceError(errorMessageOf(err, "Failed to record attendance"));
    } finally {
      setAttendingId(null);
    }
  }

  /**
   * Mark everyone who booked and has not been checked in yet.
   *
   * Sequential on purpose: each member is a separate entitlement decision
   * backend-side (a credit here, a drop-in visit there), and firing twenty
   * parallel writes would make a refusal impossible to attribute. Every answer
   * is kept, so the summary says exactly who could not be marked and why —
   * a refused member never disappears behind a cheerful total.
   */
  async function markAllPresent() {
    if (attendingId || bulkRunning) return;
    const pending = attendees.filter(
      (b) =>
        !b.isCancelled &&
        (b.bookingStatus ?? "").toLowerCase() !== "attended"
    );
    if (pending.length === 0) return;

    setBulkRunning(true);
    setAttendanceError("");
    setAttendanceMessage("");

    const failures: string[] = [];
    let done = 0;

    for (const booking of pending) {
      const label = booking.memberName || booking.memberId;
      try {
        const result = await recordManualAttendance({
          memberId: booking.memberId,
          classScheduleId: c.id,
          branchId: c.branchId,
        });
        if (result.success) done += 1;
        else failures.push(`${label}: ${result.message}`);
      } catch (err) {
        failures.push(`${label}: ${errorMessageOf(err, "failed")}`);
      }
    }

    setBulkRunning(false);
    setReloadKey((v) => v + 1);
    if (done > 0) {
      setAttendanceMessage(`${done} of ${pending.length} members marked present.`);
    }
    if (failures.length > 0) {
      setAttendanceError(`Could not mark present — ${failures.join(" · ")}`);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                Class Schedule Detail
              </p>
              <p className="text-base font-bold text-fg truncate">{c.className}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${badge.class}`}
              >
                {badge.label}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-fg text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* The id in full: it is what the manual scanner and support ask for. */}
          <div className="mt-3 flex items-start justify-between gap-2 bg-sidebar border border-border rounded-lg px-3 py-2">
            <div className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-muted">
                Class Schedule ID
              </span>
              <span className="block text-[11px] font-mono text-accent-ink font-bold break-all select-all leading-relaxed">
                {c.id}
              </span>
            </div>
            <CopyButton value={c.id} label="Class Schedule ID" />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-1">
          {loading ? (
            <p className="text-sm text-muted py-8 text-center">Loading details...</p>
          ) : error ? (
            <p className="text-sm text-danger py-8 text-center">{error}</p>
          ) : (
            <>
              {/* Schedule */}
              <SectionHeader icon="fas fa-calendar-alt" label="Schedule" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <Row label="Class Date" value={fmtDate(c.classDate)} />
                <Row label="Start Time" value={c.startTime?.slice(0, 5) ?? null} />
                <Row label="End Time" value={c.endTime?.slice(0, 5) ?? null} />
                <Row label="Class Name" value={c.className} highlight />
                <Row label="Class Type" value={c.classType ?? null} />
                <Row label="Difficulty Level" value={c.difficultyLevel ?? null} />
              </div>

              {/* People & Place */}
              <SectionHeader icon="fas fa-users" label="People & Place" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <Row label="Coach" value={c.coachName ?? c.coachId ?? null} />
                <Row label="Branch" value={c.branchName ?? c.branchId ?? null} />
                <Row label="Room" value={c.roomName ?? null} />
              </div>

              {/* Capacity */}
              <SectionHeader icon="fas fa-chart-bar" label="Capacity" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <Row label="Capacity" value={String(c.capacity ?? 0)} />
                <Row label="Enrolled" value={String(enrolled)} />
                <Row label="Available Slots" value={String(remainingSlotsOf(c))} />
              </div>

              {/* Status Flags */}
              <SectionHeader icon="fas fa-flag" label="Status Flags" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <Row label="Active" value={yesNo(c.isActive)} />
                <Row label="Cancelled" value={yesNo(c.isCancelled)} />
                <Row label="Completed" value={yesNo(c.isCompleted)} />
                <Row label="Session Active" value={yesNo(c.isSessionActive)} />
              </div>

              {/* Session — the admin bypass for the coach QR scan */}
              <SectionHeader icon="fas fa-bolt" label="Session" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-3 space-y-2">
                {c.isSessionActive ? (
                  <p className="text-xs text-success flex items-center gap-2">
                    <i className="fas fa-circle-check" aria-hidden />
                    Session is active — members can check in to this class.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted leading-relaxed">
                      Normally the session turns on when the coach scans the QR code. If the
                      coach cannot scan, an admin can activate it here — the request is
                      identical to the coach scan, using the Coach ID and Class Schedule ID
                      of this class.
                    </p>

                    {activationBlocker ? (
                      <p className="text-xs text-fg-soft bg-fg/5 border border-border rounded px-3 py-2">
                        {activationBlocker}
                      </p>
                    ) : confirmActivate ? (
                      <div className="space-y-2">
                        <p className="text-xs text-warning bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-2">
                          Activate the session for{" "}
                          <span className="font-bold">{c.className}</span> with coach{" "}
                          <span className="font-bold">{c.coachName ?? c.coachId}</span>?
                          Recorded in the backend just like a normal coach scan.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void runActivation()}
                            disabled={activating}
                            className="flex-1 bg-sweat text-black py-2 rounded-lg text-xs font-bold hover:brightness-95 transition disabled:opacity-60"
                          >
                            {activating ? "Activating…" : "Yes, activate session"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmActivate(false)}
                            disabled={activating}
                            className="flex-1 bg-card border border-border text-fg-soft py-2 rounded-lg text-xs font-bold disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActivateError("");
                          setActivateMessage("");
                          setConfirmActivate(true);
                        }}
                        className="w-full bg-card border border-sweat/60 text-fg py-2 rounded-lg text-xs font-bold hover:bg-sweat/10 transition flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-bolt text-accent-ink" aria-hidden />
                        Activate Session (bypass coach scan)
                      </button>
                    )}
                  </>
                )}

                {activateMessage && (
                  <p className="text-xs text-success bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
                    {activateMessage}
                  </p>
                )}
                {activateError && (
                  <p className="text-xs text-danger bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                    {activateError}
                  </p>
                )}
              </div>

              {/* Cancellation */}
              {c.cancelReason && (
                <>
                  <SectionHeader icon="fas fa-ban" label="Cancellation" />
                  <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
                    <p className="text-sm text-fg-soft whitespace-pre-wrap">
                      {c.cancelReason}
                    </p>
                  </div>
                </>
              )}

              {/* Workout / class details — the existing `description` field */}
              <SectionHeader icon="fas fa-dumbbell" label="Workout / Class Details" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
                {c.description ? (
                  <p className="text-sm text-fg-soft whitespace-pre-wrap font-mono leading-relaxed">
                    {c.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted">No workout details yet.</p>
                )}
              </div>

              {/* Members — booked, walk-in, and marked present from here */}
              <SectionHeader icon="fas fa-user-friends" label="Members" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
                {pendingAttendance.length > 0 && !attendanceClosed && (
                  <button
                    type="button"
                    onClick={() => void markAllPresent()}
                    disabled={bulkRunning || attendingId !== null}
                    className="w-full mb-2 bg-sweat text-black text-[11px] font-bold uppercase tracking-wide px-3 py-2 rounded transition hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Mark all booked participants present, without a QR scan"
                  >
                    <i className="fas fa-user-check mr-2" aria-hidden />
                    {bulkRunning
                      ? "Marking present…"
                      : `Mark all present (${pendingAttendance.length})`}
                  </button>
                )}
                {attendeesLoading ? (
                  <p className="text-xs text-muted py-1">Loading participants...</p>
                ) : attendeesError ? (
                  <p className="text-xs text-danger py-1">{attendeesError}</p>
                ) : attendees.length === 0 ? (
                  <p className="text-xs text-muted py-1">No members have booked yet.</p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {attendees.map((b) => {
                      const attended = (b.bookingStatus ?? "").toLowerCase() === "attended";
                      const canAttend = !attended && !b.isCancelled && !attendanceClosed;
                      return (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm text-fg-soft truncate">
                              {b.memberName || b.memberId}
                            </span>
                            {b.bookingDate && (
                              <span className="block text-[10px] text-muted">
                                Booked {new Date(b.bookingDate).toLocaleDateString("en-GB")}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {canAttend && (
                              <button
                                type="button"
                                onClick={() =>
                                  void markPresent(b.memberId, b.memberName || "Member")
                                }
                                disabled={attendingId !== null || bulkRunning}
                                className="text-[10px] font-bold uppercase tracking-wide border border-border text-fg-soft hover:text-fg hover:border-sweat px-2 py-1 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Mark present without scanning the member QR code"
                              >
                                {attendingId === b.memberId ? "Marking…" : "Mark present"}
                              </button>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                b.isCancelled
                                  ? "bg-red-500/10 text-danger border-red-500/30"
                                  : attended
                                    ? "bg-green-500/10 text-success border-green-500/30"
                                    : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                              }`}
                            >
                              {b.isCancelled ? "Cancelled" : (b.bookingStatus || "Booked")}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Walk-in: no booking needed — the backend books them as part
                    of recording the attendance. */}
                {!attendanceClosed && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    {!walkInOpen ? (
                      <button
                        type="button"
                        onClick={() => setWalkInOpen(true)}
                        className="w-full text-[11px] font-bold uppercase tracking-wide border border-dashed border-border text-muted hover:text-fg hover:border-sweat px-3 py-2 rounded transition"
                      >
                        <i className="fas fa-user-plus mr-2" aria-hidden />
                        Walk-in — mark a member present without a booking
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                            Walk-in
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setWalkInOpen(false);
                              setWalkInQuery("");
                              setWalkInResults([]);
                            }}
                            className="text-muted hover:text-fg text-xs"
                          >
                            Close
                          </button>
                        </div>
                        <input
                          value={walkInQuery}
                          onChange={(e) => setWalkInQuery(e.target.value)}
                          autoFocus
                          placeholder="Search by name / member code / email"
                          className="w-full bg-card border border-border text-fg text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sweat"
                        />
                        {walkInSearching ? (
                          <p className="text-[11px] text-muted">Searching…</p>
                        ) : walkInQuery.trim().length < 2 ? (
                          <p className="text-[11px] text-muted">
                            Type at least 2 characters. Members without a booking are
                            booked automatically by the backend when marked present.
                          </p>
                        ) : walkInResults.length === 0 ? (
                          <p className="text-[11px] text-muted">
                            No matching members.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {walkInResults.map((m) => {
                              const already = attendees.some(
                                (b) => b.memberId === m.id && !b.isCancelled
                              );
                              return (
                                <li
                                  key={m.id}
                                  className="flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-3 py-2"
                                >
                                  <span className="min-w-0">
                                    <span className="block text-sm text-fg truncate">
                                      {memberDisplayName(m)}
                                    </span>
                                    <span className="block text-[10px] text-muted truncate">
                                      {m.memberCode || m.email}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void markPresent(
                                        m.id,
                                        memberDisplayName(m),
                                        m.memberCode
                                      )
                                    }
                                    disabled={attendingId !== null || bulkRunning || already}
                                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-sweat text-black px-2.5 py-1.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {already
                                      ? "Already listed"
                                      : attendingId === m.id
                                        ? "Marking…"
                                        : "Mark present"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {attendanceClosed && (
                  <p className="mt-2 pt-2 border-t border-border/40 text-[11px] text-muted">
                    Class has been {c.isCancelled ? "cancelled" : "completed"} — attendance
                    is closed by the backend.
                  </p>
                )}

                {attendanceMessage && (
                  <p className="mt-2 text-[11px] text-green-600 bg-green-500/10 border border-green-500/30 px-3 py-2 rounded">
                    <i className="fas fa-check mr-1.5" aria-hidden />
                    {attendanceMessage}
                  </p>
                )}
                {attendanceError && (
                  <p className="mt-2 text-[11px] text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                    {attendanceError}
                  </p>
                )}
              </div>

              {/* Identifiers */}
              <SectionHeader icon="fas fa-fingerprint" label="Identifiers" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <IdRow label="Class Schedule ID" value={c.id} />
                <IdRow label="Coach ID" value={c.coachId} />
                <IdRow label="Branch ID" value={c.branchId} />
              </div>

              {/* Timestamps */}
              <SectionHeader icon="fas fa-clock" label="Timestamps" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                <Row label="Created" value={fmtDateTime(c.createdAt)} />
                <Row label="Updated" value={fmtDateTime(c.updatedAt)} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-sidebar border border-border text-fg-soft px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-fg transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
