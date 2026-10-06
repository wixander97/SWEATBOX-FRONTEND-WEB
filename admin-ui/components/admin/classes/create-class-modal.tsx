"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { formatCountInput, parseCountInput } from "@/lib/number-input";
import { RecurrenceFields } from "@/components/admin/classes/recurrence-fields";
import { AssistantCoachSelector } from "@/components/admin/assistant-coach-selector";
import { classDurationMinutes, timeToMinutes } from "@/components/admin/classes/classes.types";
import type {
  AssistantCoachAssignment,
  AssistantCoachSelection,
} from "@/lib/class-schedules";
import {
  emptyRecurrence,
  formatDateOnly,
  isRepeating,
  validateRecurrence,
  weeklyOn,
  type RecurrenceRule,
} from "@/lib/classes/recurrence";

export type ClassFormValues = {
  className: string;
  coachId: string;
  classDate: string;
  startTime: string;
  /** Start + duration; still sent so older backends keep working. */
  endTime: string;
  /** The class length; newer backends derive endTime from it. */
  durationMinutes?: number;
  capacity: number;
  branchId: string;
  roomName: string;
  description: string;
  classType: string;
  difficultyLevel: string;
  isActive: boolean;
  /**
   * Assistants on the occurrence; the API accepts none, one or several.
   * Creating a class sends only who they are — each seat is paid the branch
   * default — while editing also carries each seat's tier override.
   */
  assistantCoaches: Array<AssistantCoachSelection | AssistantCoachAssignment>;
  /**
   * Primary coach's rate tier; null lets the branch default apply. Sent only
   * when editing: scheduling a class never asks for a rate.
   */
  coachRateTierId?: string | null;
};

/** Present when an edit applies to this class and every later one in its series. */
export type SeriesScope = {
  /** First date (`YYYY-MM-DD`) the change applies to. */
  effectiveFrom: string;
};

/** Offered when editing an occurrence that belongs to a recurring series. */
export type SeriesEditOptions = {
  /** This occurrence's date (`YYYY-MM-DD`), the default Effective From. */
  occurrenceDate: string;
  /** The series' current rule; null while it loads or when it failed. */
  recurrence: RecurrenceRule | null;
  loading: boolean;
  error?: string;
  /** Opens the "End repeating" confirmation. */
  onEndRepeating?: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  initialValues?: Partial<ClassFormValues>;
  /** Recurrence to start from (Duplicate); defaults to "Does not repeat". */
  initialRecurrence?: RecurrenceRule;
  /**
   * Focus and highlight Start Time on open. Duplicate sets it: the copy keeps
   * every setting, so the time is usually the only thing left to change.
   */
  focusStartTime?: boolean;
  /**
   * Present when editing an existing occurrence: offers the workout for that
   * date, which is programmed in the workout module rather than here.
   */
  onManageWorkout?: () => void;
  submitLabel?: string;
  trainerOptions: Array<{ id: string; name: string }>;
  /**
   * Enable the recurrence section. Only meaningful when creating: editing a
   * single occurrence never rewrites a whole series.
   */
  allowRecurrence?: boolean;
  /**
   * Keep each seat's existing rate tier in the payload. Only the edit form
   * sets this; rate tiers are not shown or changed in this form, and a new
   * class is paid the default tier for its branch and date.
   */
  allowRateOverride?: boolean;
  /** Editing an occurrence of a series: adds "Apply changes to". */
  seriesEdit?: SeriesEditOptions;
  onSubmit: (
    values: ClassFormValues,
    recurrence?: RecurrenceRule,
    scope?: SeriesScope
  ) => Promise<void>;
};

type Branch = {
  id: string;
  branchName: string;
  isActive: boolean;
};

type ClassFormState = {
  className: string;
  coachId: string;
  branchId: string;
  classDate: string;
  startTime: string;
  durationHours: number;
  durationMinutes: number;
  capacity: number;
  roomName: string;
  description: string;
  classType: string;
  difficultyLevel: string;
  coachRateTierId: string;
};

const WORKOUT_PLACEHOLDER = `Warm Up
10 min mobility

Strength
4 x 10 Squats
4 x 10 Lunges

Conditioning
10 min AMRAP

Cool Down
5 min stretching`;

const INPUT_CLASS =
  "w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat disabled:opacity-50";

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);
const DAY_MINUTES = 24 * 60;

function emptyClassForm(): ClassFormState {
  return {
    className: "",
    coachId: "",
    branchId: "",
    classDate: "",
    startTime: "08:00",
    durationHours: 1,
    durationMinutes: 0,
    capacity: 20,
    roomName: "Main Hall",
    description: "",
    classType: "",
    difficultyLevel: "",
    coachRateTierId: "",
  };
}

// Normalize HH:mm to HH:mm:ss for backend compatibility
function normalizeTime(time: string): string {
  if (!time) return "";
  // If already in HH:mm:ss format, return as-is
  if (time.split(":").length === 3) return time;
  // Append :00 seconds for HH:mm format
  return `${time}:00`;
}

function toIsoDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** End of the class in minutes after midnight, or null without a start time. */
function endMinutesOf(form: ClassFormState): number | null {
  const start = timeToMinutes(form.startTime);
  if (start == null) return null;
  return start + form.durationHours * 60 + form.durationMinutes;
}

function todayDate(): string {
  return formatDateOnly(new Date());
}

export function CreateClassModal({
  open,
  onClose,
  title = "Create New Class",
  submitLabel = "Create Schedule",
  initialValues,
  initialRecurrence,
  focusStartTime = false,
  trainerOptions,
  allowRecurrence = false,
  allowRateOverride = false,
  seriesEdit,
  onManageWorkout,
  onSubmit,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ClassFormState>(emptyClassForm());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(emptyRecurrence());
  const [assistants, setAssistants] = useState<AssistantCoachAssignment[]>([]);
  /** "following" rewrites this class and every later one in its series. */
  const [applyTo, setApplyTo] = useState<"one" | "following">("one");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const startTimeRef = useRef<HTMLInputElement>(null);
  const seriesRecurrence = seriesEdit?.recurrence ?? null;
  const occurrenceDate = seriesEdit?.occurrenceDate ?? "";
  const following = Boolean(seriesEdit) && applyTo === "following";
  const showRecurrence = allowRecurrence || following;

  // Load branches
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
  // Sync form state when initialValues changes (edit / duplicate)
  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      const startTime = initialValues.startTime ? initialValues.startTime.slice(0, 5) : "08:00";
      const duration =
        classDurationMinutes({
          durationMinutes: initialValues.durationMinutes,
          startTime,
          endTime: initialValues.endTime ?? "",
        }) ?? 60;
      setForm({
        className: initialValues.className ?? "",
        coachId: initialValues.coachId ?? "",
        branchId: initialValues.branchId ?? "",
        classDate: initialValues.classDate
          ? initialValues.classDate.slice(0, 10)
          : "",
        startTime,
        durationHours: Math.floor(duration / 60),
        durationMinutes: duration % 60,
        capacity: initialValues.capacity ?? 20,
        roomName: initialValues.roomName ?? "Main Hall",
        description: initialValues.description ?? "",
        classType: initialValues.classType ?? "",
        difficultyLevel: initialValues.difficultyLevel ?? "",
        coachRateTierId: initialValues.coachRateTierId ?? "",
      });
      setAssistants(
        (initialValues.assistantCoaches ?? []).map((assistant) => ({
          coachId: assistant.coachId,
          coachRateTierId:
            "coachRateTierId" in assistant ? assistant.coachRateTierId : null,
        }))
      );
    } else {
      setForm(emptyClassForm());
      setAssistants([]);
    }
    setRecurrence(initialRecurrence ?? emptyRecurrence());
    setApplyTo("one");
    setError("");
  }, [open, initialValues, initialRecurrence]);

  // Effective From starts at this occurrence, but never before today.
  useEffect(() => {
    if (!open || !occurrenceDate) return;
    const today = todayDate();
    setEffectiveFrom(occurrenceDate < today ? today : occurrenceDate);
  }, [open, occurrenceDate]);

  // The series rule arrives after the modal opens; it seeds the recurrence block.
  useEffect(() => {
    if (open && seriesRecurrence) setRecurrence(seriesRecurrence);
  }, [open, seriesRecurrence]);

  // Duplicate: put the cursor on the one field that usually changes.
  useEffect(() => {
    if (!open || !focusStartTime) return;
    const timer = setTimeout(() => startTimeRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open, focusStartTime]);

  const durationTotal = form.durationHours * 60 + form.durationMinutes;
  const endMinutes = endMinutesOf(form);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      if (!(form.capacity >= 1)) {
        setError("Capacity must be at least 1");
        return;
      }
      if (durationTotal <= 0) {
        setError("Duration must be greater than 0.");
        return;
      }
      if (endMinutes == null || endMinutes > DAY_MINUTES) {
        setError("A class must finish on the day it starts.");
        return;
      }
      if (following) {
        if (!effectiveFrom) {
          setError("Effective From is required.");
          return;
        }
        if (effectiveFrom < todayDate()) {
          setError("Effective From cannot be in the past.");
          return;
        }
        if (!isRepeating(recurrence)) {
          setError("Choose how the class repeats.");
          return;
        }
      }
      if (showRecurrence) {
        const check = validateRecurrence(
          recurrence,
          following ? effectiveFrom : form.classDate
        );
        if (!check.ok) {
          setError(check.message);
          return;
        }
      }
      // The API rejects a duplicate coach rather than de-duplicating, so it is
      // caught here too — the selector should already have made it impossible.
      const seen = new Set<string>([form.coachId]);
      for (const assistant of assistants) {
        if (!assistant.coachId || seen.has(assistant.coachId)) {
          setError("Each coach can only be on the class once.");
          return;
        }
        seen.add(assistant.coachId);
      }
      setSubmitting(true);

      const base = {
        className: form.className,
        coachId: form.coachId,
        branchId: form.branchId,
        capacity: form.capacity,
        roomName: form.roomName,
        description: form.description,
        classType: form.classType,
        difficultyLevel: form.difficultyLevel,
        classDate: toIsoDate(following ? effectiveFrom : form.classDate),
        startTime: normalizeTime(form.startTime),
        // 24:00 is not a valid time of day; newer backends use the duration.
        endTime: `${formatMinutes(Math.min(endMinutes, DAY_MINUTES - 1))}:00`,
        durationMinutes: durationTotal,
        isActive: true,
      };
      // Creating (and rewriting a series) sends no rate at all; editing one
      // class keeps each seat's tier so an existing override is neither lost
      // nor changed by an unrelated edit.
      const payload: ClassFormValues =
        allowRateOverride && !following
          ? {
              ...base,
              coachRateTierId: form.coachRateTierId || null,
              assistantCoaches: assistants,
            }
          : {
              ...base,
              assistantCoaches: assistants.map(({ coachId }) => ({ coachId })),
            };

      try {
        if (following) {
          await onSubmit(payload, recurrence, { effectiveFrom });
        } else {
          await onSubmit(
            payload,
            allowRecurrence && isRepeating(recurrence) ? recurrence : undefined
          );
        }
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to submit";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [
      onClose,
      onSubmit,
      form,
      allowRecurrence,
      allowRateOverride,
      recurrence,
      assistants,
      durationTotal,
      endMinutes,
      following,
      effectiveFrom,
      showRecurrence,
    ]
  );

  if (!open) return null;

  // Keep an unusual stored length (e.g. 47 min) selectable when editing.
  const minuteOptions = MINUTE_OPTIONS.includes(form.durationMinutes)
    ? MINUTE_OPTIONS
    : [...MINUTE_OPTIONS, form.durationMinutes].sort((a, b) => a - b);
  const hourOptions = HOUR_OPTIONS.includes(form.durationHours)
    ? HOUR_OPTIONS
    : [...HOUR_OPTIONS, form.durationHours];

  return (
    <div
      id="modal-overlay"
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
        id="modal-box"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold font-display uppercase" id="modal-title">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div id="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Apply changes to (occurrence of a series) */}
              {seriesEdit && (
                <div className="border border-border rounded-lg p-3 space-y-2 bg-sidebar/40">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">
                    Apply changes to
                  </p>
                  <label className="flex items-center gap-2 text-sm text-fg">
                    <input
                      type="radio"
                      name="apply-to"
                      checked={applyTo === "one"}
                      onChange={() => setApplyTo("one")}
                      disabled={submitting}
                      className="accent-sweat"
                    />
                    This class only
                  </label>
                  <label className="flex items-center gap-2 text-sm text-fg">
                    <input
                      type="radio"
                      name="apply-to"
                      checked={applyTo === "following"}
                      onChange={() => {
                        setApplyTo("following");
                        // A series always repeats; seed a rule if the real one is not in yet.
                        if (!isRepeating(recurrence)) {
                          setRecurrence(seriesRecurrence ?? weeklyOn(effectiveFrom || occurrenceDate));
                        }
                      }}
                      disabled={submitting}
                      className="accent-sweat"
                    />
                    This and following classes
                  </label>
                  {following && (
                    <div className="text-[11px] text-muted space-y-1 pt-1">
                      {seriesEdit.loading && <p>Loading the recurring schedule...</p>}
                      {seriesEdit.error && <p className="text-danger">{seriesEdit.error}</p>}
                      <p>
                        Classes before Effective From stay as they are. Later classes
                        take these settings; their bookings are kept.
                      </p>
                      {seriesEdit.onEndRepeating && (
                        <button
                          type="button"
                          onClick={seriesEdit.onEndRepeating}
                          disabled={submitting}
                          className="mt-1 bg-sidebar border border-border text-fg px-3 py-1.5 rounded-lg text-xs hover:bg-fg/5 transition disabled:opacity-50"
                        >
                          <i className="fas fa-stop-circle mr-1.5" aria-hidden />
                          End repeating…
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Class Name */}
              <div>
                <label className="block text-muted text-sm mb-1">
                  Class Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="e.g. Boxing 101"
                  name="className"
                  value={form.className}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, className: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Branch + Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Branch <span className="text-danger">*</span>
                  </label>
                  <select
                    value={form.branchId}
                    onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                    disabled={branchesLoading || following}
                    title={following ? "A recurring class cannot change branch." : undefined}
                    className={INPUT_CLASS}
                  >
                    <option value="">{branchesLoading ? "Loading branches..." : "Select Branch..."}</option>

                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branchName}
                      </option>

                    ))}
                    {!branchesLoading && branches.length === 0 && (
                      <option value="" disabled>No active branches</option>
                    )}
                    {!branchesLoading && form.branchId && !branches.find((b) => b.id === form.branchId) && (
                      <option value={form.branchId} disabled>
                        ⚠️ Branch not found (ID: {form.branchId})
                      </option>
                    )}
                  </select>
                  {following && (
                    <p className="text-[11px] text-muted mt-1">
                      A recurring class keeps its branch.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Location <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    name="roomName"
                    value={form.roomName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, roomName: e.target.value }))
                    }
                    placeholder="Main Hall"
                    required
                  />
                </div>
              </div>

              {/* Begin Date (or Effective From) + Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {following ? (
                  <div>
                    <label className="block text-muted text-sm mb-1">
                      Effective From <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      style={{ colorScheme: "dark" }}
                      name="effectiveFrom"
                      value={effectiveFrom}
                      min={todayDate()}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-muted text-sm mb-1">
                      Begin Date <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      style={{ colorScheme: "dark" }}
                      name="classDate"
                      value={form.classDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, classDate: e.target.value }))
                      }
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Start Time <span className="text-danger">*</span>
                  </label>
                  <input
                    ref={startTimeRef}
                    type="time"
                    className={`${INPUT_CLASS} ${focusStartTime ? "border-sweat ring-2 ring-sweat/40" : ""}`}
                    style={{ colorScheme: "dark" }}
                    name="startTime"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    required
                  />
                  {focusStartTime && (
                    <p className="text-[11px] text-accent-ink mt-1">
                      Set the time for the new class.
                    </p>
                  )}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-muted text-sm mb-1">
                  Duration <span className="text-danger">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Duration hours"
                    className={`${INPUT_CLASS} w-auto`}
                    value={form.durationHours}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationHours: Number(e.target.value) }))
                    }
                  >
                    {hourOptions.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-muted">hr</span>
                  <select
                    aria-label="Duration minutes"
                    className={`${INPUT_CLASS} w-auto`}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))
                    }
                  >
                    {minuteOptions.map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-muted">mins</span>
                  {endMinutes != null && durationTotal > 0 && (
                    <span
                      className={`text-xs ml-auto ${endMinutes > DAY_MINUTES ? "text-danger" : "text-muted"}`}
                    >
                      {endMinutes > DAY_MINUTES
                        ? "Ends after midnight"
                        : `Ends at ${formatMinutes(endMinutes)}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Trainer + Assistant Trainer(s) */}
              <div>
                <label className="block text-muted text-sm mb-1">
                  Trainer <span className="text-danger">*</span>
                </label>
                <select
                  className={INPUT_CLASS}
                  name="coachId"
                  value={form.coachId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, coachId: e.target.value }))
                  }
                  required
                >
                  <option value="" disabled>
                    Select trainer
                  </option>
                  {trainerOptions.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </option>
                  ))}
                </select>
              </div>

              <AssistantCoachSelector
                value={assistants}
                onChange={setAssistants}
                coaches={trainerOptions}
                branchId={form.branchId}
                primaryCoachId={form.coachId}
                disabled={submitting}
              />

              {/* Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Capacity <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={INPUT_CLASS}
                    name="capacity"
                    value={formatCountInput(form.capacity)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        capacity: parseCountInput(e.target.value),
                      }))
                    }
                    required
                  />
                </div>
              </div>

              {/* Class Type + Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Class Type <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    name="classType"
                    value={form.classType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, classType: e.target.value }))
                    }
                    placeholder="e.g. HIIT, Boxing, Yoga"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Difficulty <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    name="difficultyLevel"
                    value={form.difficultyLevel}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        difficultyLevel: e.target.value,
                      }))
                    }
                    placeholder="e.g. Beginner, Intermediate, Advanced"
                    required
                  />
                </div>
              </div>

              {/* Workout / class details — stored in the existing `description` field */}
              <div>
                <label className="block text-muted text-sm mb-1">
                  Workout / Class Details
                </label>
                <textarea
                  className={`${INPUT_CLASS} font-mono text-sm leading-relaxed`}
                  name="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={10}
                  placeholder={WORKOUT_PLACEHOLDER}
                />
                <p className="text-[11px] text-muted mt-1">
                  Multiline supported — write warm up, strength, conditioning, and cool
                  down. Saved to the existing description field.
                </p>
              </div>

              {onManageWorkout && !following && (
                <button
                  type="button"
                  onClick={onManageWorkout}
                  className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg text-sm hover:bg-fg/5 transition"
                >
                  <i className="fas fa-dumbbell mr-2" aria-hidden />
                  Manage workout for this date
                </button>
              )}

              {/* Recurrence (create, or a series from Effective From) */}
              {showRecurrence && (
                <RecurrenceFields
                  value={recurrence}
                  onChange={setRecurrence}
                  startDate={following ? effectiveFrom : form.classDate}
                  disabled={submitting}
                  allowNone={!following}
                />
              )}

              {/* Error */}
              {error ? (
                <p className="text-sm text-danger bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                  {error}
                </p>
              ) : null}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || (following && Boolean(seriesEdit?.loading))}
                className="w-full bg-sweat text-black font-bold py-3 rounded-lg mt-4 hover:bg-yellow-400 transition disabled:opacity-70"
              >
                {submitting
                  ? "Saving..."
                  : following
                    ? "Save This & Following"
                    : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
