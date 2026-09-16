"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { formatCountInput, parseCountInput } from "@/lib/number-input";
import { RecurrenceFields } from "@/components/admin/classes/recurrence-fields";
import { AssistantCoachSelector } from "@/components/admin/assistant-coach-selector";
import { apiRequest } from "@/lib/api/client";
import type {
  AssistantCoachAssignment,
  AssistantCoachSelection,
} from "@/lib/class-schedules";
import { RATE_TYPES, tiersFor, type CoachRateTier } from "@/lib/coach-rates";
import { formatCurrency } from "@/lib/format";
import {
  emptyRecurrence,
  expandRecurrence,
  isRepeating,
  validateRecurrence,
  type RecurrenceRule,
} from "@/lib/classes/recurrence";

export type ClassFormValues = {
  className: string;
  coachId: string;
  classDate: string;
  startTime: string;
  endTime: string;
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

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  initialValues?: Partial<ClassFormValues>;
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
   * Offer the per-class rate tier overrides. Only the edit form sets this:
   * creating a schedule never asks for a rate, and every seat on a new class
   * is paid the default tier for its branch and date.
   */
  allowRateOverride?: boolean;
  onSubmit: (values: ClassFormValues, recurrence?: RecurrenceRule) => Promise<void>;
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
  endTime: string;
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

function emptyClassForm(): ClassFormState {
  return {
    className: "",
    coachId: "",
    branchId: "",
    classDate: "",
    startTime: "08:00",
    endTime: "09:00",
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

export function CreateClassModal({
  open,
  onClose,
  title = "Create New Class",
  submitLabel = "Create Schedule",
  initialValues,
  trainerOptions,
  allowRecurrence = false,
  allowRateOverride = false,
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
  const [rateTiers, setRateTiers] = useState<CoachRateTier[]>([]);
  // Rate tiers are optional on a class: without them the backend falls back to
  // the branch default, so a failed load only hides the choice. Only the edit
  // form offers them, so creating a class does not load them at all.
  useEffect(() => {
    if (!open || !allowRateOverride) return;
    let cancelled = false;
    apiRequest<CoachRateTier[]>("/api/coach-rate-tiers", { query: { isActive: true } })
      .then((data) => {
        if (!cancelled) setRateTiers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRateTiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, allowRateOverride]);
  const coachTiers = useMemo(
    () => tiersFor(rateTiers, RATE_TYPES.coach, form.branchId),
    [rateTiers, form.branchId]
  );
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
  // Sync form state when initialValues changes (edit mode)
  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setForm({
        className: initialValues.className ?? "",
        coachId: initialValues.coachId ?? "",
        branchId: initialValues.branchId ?? "",
        classDate: initialValues.classDate
          ? initialValues.classDate.slice(0, 10)
          : "",
        startTime: initialValues.startTime ? initialValues.startTime.slice(0, 5) : "08:00",
        endTime: initialValues.endTime ? initialValues.endTime.slice(0, 5) : "09:00",
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
    setRecurrence(emptyRecurrence());
  }, [open, initialValues]);



  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      if (!(form.capacity >= 1)) {
        setError("Capacity must be at least 1");
        return;
      }
      if (allowRecurrence) {
        const check = validateRecurrence(recurrence, form.classDate);
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

      const { coachRateTierId, ...fields } = form;
      const base = {
        ...fields,
        classDate: toIsoDate(form.classDate),
        startTime: normalizeTime(form.startTime),
        endTime: normalizeTime(form.endTime),
        isActive: true,
      };
      // Creating sends no rate at all; editing keeps each seat's tier so an
      // existing override is neither lost nor changed by an unrelated edit.
      const payload: ClassFormValues = allowRateOverride
        ? {
            ...base,
            coachRateTierId: coachRateTierId || null,
            assistantCoaches: assistants,
          }
        : {
            ...base,
            assistantCoaches: assistants.map(({ coachId }) => ({ coachId })),
          };

      try {
        await onSubmit(
          payload,
          allowRecurrence && isRepeating(recurrence) ? recurrence : undefined
        );
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to submit";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [onClose, onSubmit, form, allowRecurrence, allowRateOverride, recurrence, assistants]
  );

  if (!open) return null;

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
              {/* Class Name */}
              <div>
                <label className="block text-muted text-sm mb-1">
                  Class Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  placeholder="e.g. Boxing 101"
                  name="className"
                  value={form.className}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, className: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Trainer + Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Trainer <span className="text-danger">*</span>
                  </label>
                  <select
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
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
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Capacity <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
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

              {/* Class Date + Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Class Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    style={{ colorScheme: 'dark' }}
                    name="classDate"
                    value={form.classDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, classDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Start Time <span className="text-danger">*</span>
                  </label>
                  <input
                    type="time"
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    style={{ colorScheme: 'dark' }}
                    name="startTime"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              {/* End Time + Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted text-sm mb-1">
                    End Time <span className="text-danger">*</span>
                  </label>
                  <input
                    type="time"
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    style={{ colorScheme: 'dark' }}
                    name="endTime"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Branch <span className="text-danger">*</span>
                  </label>
                  <select
                    value={form.branchId}
                    onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                    disabled={branchesLoading}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat disabled:opacity-50"
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
                </div>



              </div>

              {/* Room */}
              <div>
                <label className="block text-muted text-sm mb-1">
                  Room <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  name="roomName"
                  value={form.roomName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roomName: e.target.value }))
                  }
                  placeholder="Main Hall"
                  required
                />
              </div>

              {/* Coach pay override: edit only. A new class uses the branch default. */}
              {allowRateOverride && (
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Coach Rate Tier
                  </label>
                  <select
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="coachRateTierId"
                    value={form.coachRateTierId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, coachRateTierId: e.target.value }))
                    }
                  >
                    <option value="">Branch default</option>
                    {coachTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} · {formatCurrency(tier.rate)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <AssistantCoachSelector
                value={assistants}
                onChange={setAssistants}
                coaches={trainerOptions}
                tiers={allowRateOverride ? rateTiers : undefined}
                branchId={form.branchId}
                primaryCoachId={form.coachId}
                disabled={submitting}
              />

              {/* Class Type + Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted text-sm mb-1">
                    Class Type <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
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
                    className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
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
                  className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat font-mono text-sm leading-relaxed"
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

              {onManageWorkout && (
                <button
                  type="button"
                  onClick={onManageWorkout}
                  className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg text-sm hover:bg-fg/5 transition"
                >
                  <i className="fas fa-dumbbell mr-2" aria-hidden />
                  Manage workout for this date
                </button>
              )}

              {/* Recurrence (create only) */}
              {allowRecurrence && (
                <RecurrenceFields
                  value={recurrence}
                  onChange={setRecurrence}
                  startDate={form.classDate}
                  disabled={submitting}
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
                disabled={submitting}
                className="w-full bg-sweat text-black font-bold py-3 rounded-lg mt-4 hover:bg-yellow-400 transition disabled:opacity-70"
              >
                {submitting
                  ? allowRecurrence && isRepeating(recurrence)
                    ? `Creating ${expandRecurrence(recurrence, form.classDate).length} schedules...`
                    : "Submitting..."
                  : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div >
    </div >
  );
}