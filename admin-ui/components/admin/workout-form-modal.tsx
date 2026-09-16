"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import {
  Field,
  FormError,
  InfoNote,
  inputClass,
  LABEL_CLASS,
} from "@/components/ui/field";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  formatDate,
  formatTime,
  dateToWire,
  dateTimeToWire,
  toDateInput,
  toTimeInput,
  todayInJakarta,
} from "@/lib/format";
import type { ClassSchedule } from "@/lib/class-schedules";
import {
  PUBLISH_MODES,
  modeFromStatus,
  type PublishMode,
  type Workout,
  type WorkoutRequest,
} from "@/lib/workouts";

/**
 * Writing one workout for one class occurrence.
 *
 * Saving and publishing are separate decisions here, which is the whole point
 * of the screen: the publication mode is an explicit choice on the form and
 * defaults to Draft, so finishing a workout never releases it to members by
 * accident. The backend takes the same view — an unrecognised or missing mode
 * is treated as Draft — so the two ends agree on the safe direction.
 */

const CONTENT_PLACEHOLDER = `Warm Up
10 min mobility

Strength
4 x 10 Squats
4 x 10 Lunges

Conditioning
10 min AMRAP

Cool Down
5 min stretch`;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Absent when creating. */
  workout?: Workout | null;
  classes: ClassSchedule[];
  classesLoading?: boolean;
  /** Preselected occurrence when opened from the class list. */
  defaultClassScheduleId?: string | null;
  onSubmit: (values: WorkoutRequest) => Promise<void>;
};

type FormState = {
  title: string;
  classScheduleId: string;
  workoutDate: string;
  content: string;
  publishMode: PublishMode;
  publishDate: string;
  publishTime: string;
};

function initialState(
  workout: Workout | null | undefined,
  defaultClassScheduleId: string | null | undefined
): FormState {
  if (workout) {
    return {
      title: workout.title ?? "",
      classScheduleId: workout.classScheduleId ?? "",
      workoutDate: toDateInput(workout.workoutDate),
      content: workout.content ?? "",
      publishMode: modeFromStatus(workout.status),
      publishDate: toDateInput(workout.publishAt),
      publishTime: toTimeInput(workout.publishAt),
    };
  }
  return {
    title: "",
    classScheduleId: defaultClassScheduleId ?? "",
    workoutDate: "",
    content: "",
    publishMode: PUBLISH_MODES.draft,
    publishDate: "",
    publishTime: "",
  };
}

const MODE_OPTIONS: {
  value: PublishMode;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: PUBLISH_MODES.draft,
    label: "Save as Draft",
    description: "Members cannot see it. You can publish later.",
    icon: "fa-pen",
  },
  {
    value: PUBLISH_MODES.publishNow,
    label: "Publish Now",
    description: "Members can read it as soon as you save.",
    icon: "fa-bolt",
  },
  {
    value: PUBLISH_MODES.schedule,
    label: "Schedule Publish",
    description: "Stays hidden until the date and time you choose.",
    icon: "fa-clock",
  },
];

export function WorkoutFormModal({
  open,
  onClose,
  workout,
  classes,
  classesLoading,
  defaultClassScheduleId,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(workout, defaultClassScheduleId)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reopening the dialog for a different workout has to reset the fields; the
  // component stays mounted between openings.
  useEffect(() => {
    if (!open) return;
    setForm(initialState(workout, defaultClassScheduleId));
    setError(null);
    setFieldErrors({});
  }, [open, workout, defaultClassScheduleId]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === form.classScheduleId) ?? null,
    [classes, form.classScheduleId]
  );

  /**
   * Picking a class fills the workout date from the occurrence, which is what
   * the backend would do anyway when the date is left empty — showing it keeps
   * the form honest about the date being saved.
   */
  function chooseClass(id: string) {
    const occurrence = classes.find((c) => c.id === id);
    setForm((prev) => ({
      ...prev,
      classScheduleId: id,
      workoutDate: occurrence
        ? toDateInput(occurrence.classDate)
        : prev.workoutDate,
    }));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Workout title is required.";
    if (!form.content.trim()) errors.content = "Workout content is required.";
    if (!form.classScheduleId && !form.workoutDate) {
      errors.workoutDate =
        "Choose a class, or set the date this workout is performed.";
    }
    if (form.publishMode === PUBLISH_MODES.schedule) {
      if (!form.publishDate) errors.publishDate = "Publish date is required.";
      if (!form.publishTime) errors.publishTime = "Publish time is required.";
    }
    return errors;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Please correct the highlighted fields.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title: form.title.trim(),
        classScheduleId: form.classScheduleId || null,
        workoutDate: dateToWire(form.workoutDate),
        // The occurrence carries the branch; the API reads it from there.
        branchId: null,
        content: form.content,
        publishMode: form.publishMode,
        publishAt:
          form.publishMode === PUBLISH_MODES.schedule
            ? dateTimeToWire(form.publishDate, form.publishTime)
            : null,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setFieldErrors(err.fieldErrors);
      }
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const scheduling = form.publishMode === PUBLISH_MODES.schedule;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      size="lg"
      title={workout ? "Edit Workout" : "Create Workout"}
      subtitle={
        workout
          ? `Currently ${workout.effectiveStatus.toLowerCase()}`
          : "Programming for one class on one date"
      }
    >
      <form onSubmit={handleSubmit} id="workout-form" className="space-y-5">
        <Field
          label="Class Occurrence"
          htmlFor="wf-class"
          hint={
            selectedClass
              ? `${formatDate(selectedClass.classDate)} • ${formatTime(
                  selectedClass.startTime
                )} • ${selectedClass.branchName ?? "-"}`
              : "Optional — a workout can be written before its class is scheduled."
          }
          error={fieldErrors.classScheduleId}
        >
          <select
            id="wf-class"
            className={inputClass(Boolean(fieldErrors.classScheduleId))}
            value={form.classScheduleId}
            onChange={(e) => chooseClass(e.target.value)}
            disabled={classesLoading}
          >
            <option value="">
              {classesLoading ? "Loading classes…" : "Not linked to a class"}
            </option>
            {classes.map((occurrence) => (
              <option key={occurrence.id} value={occurrence.id}>
                {formatDate(occurrence.classDate)} •{" "}
                {formatTime(occurrence.startTime)} • {occurrence.className}
                {occurrence.branchName ? ` • ${occurrence.branchName}` : ""}
              </option>
            ))}
            {/* The occurrence a saved workout points at may be outside the
                upcoming list; keep it selectable so editing does not detach it. */}
            {form.classScheduleId &&
            !classes.some((c) => c.id === form.classScheduleId) ? (
              <option value={form.classScheduleId}>
                {workout?.className || "Currently linked class"}
              </option>
            ) : null}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Workout Date"
            htmlFor="wf-date"
            required
            error={fieldErrors.workoutDate}
            hint="The day the workout is performed."
          >
            <input
              id="wf-date"
              type="date"
              className={inputClass(Boolean(fieldErrors.workoutDate))}
              value={form.workoutDate}
              onChange={(e) => set("workoutDate", e.target.value)}
            />
          </Field>

          <Field
            label="Workout Title"
            htmlFor="wf-title"
            required
            error={fieldErrors.title}
          >
            <input
              id="wf-title"
              type="text"
              className={inputClass(Boolean(fieldErrors.title))}
              placeholder="e.g. Wednesday Strength"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={200}
            />
          </Field>
        </div>

        <Field
          label="Workout Content"
          htmlFor="wf-content"
          required
          error={fieldErrors.content}
          hint="Line breaks are kept exactly as typed — members read it as written."
        >
          <textarea
            id="wf-content"
            rows={14}
            className={`${inputClass(
              Boolean(fieldErrors.content)
            )} font-mono text-sm leading-relaxed whitespace-pre-wrap`}
            placeholder={CONTENT_PLACEHOLDER}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
          />
        </Field>

        <fieldset className="border border-border rounded-xl p-4 space-y-3">
          <legend className={`${LABEL_CLASS} px-2 !mb-0`}>Publication</legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODE_OPTIONS.map((option) => {
              const active = form.publishMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border px-4 py-3 transition ${
                    active
                      ? "border-sweat bg-sweat/10"
                      : "border-border bg-sidebar hover:border-gray-600"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="publishMode"
                      value={option.value}
                      checked={active}
                      onChange={() => set("publishMode", option.value)}
                      className="accent-[#ffd700]"
                    />
                    <i
                      className={`fas ${option.icon} ${
                        active ? "text-sweat" : "text-gray-500"
                      }`}
                      aria-hidden
                    />
                    <span className="text-sm font-bold text-white">
                      {option.label}
                    </span>
                  </span>
                  <span className="block text-xs text-gray-500 mt-1.5">
                    {option.description}
                  </span>
                </label>
              );
            })}
          </div>

          {scheduling ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Field
                label="Publish Date"
                htmlFor="wf-publish-date"
                required
                error={fieldErrors.publishDate}
              >
                <input
                  id="wf-publish-date"
                  type="date"
                  min={todayInJakarta()}
                  className={inputClass(Boolean(fieldErrors.publishDate))}
                  value={form.publishDate}
                  onChange={(e) => set("publishDate", e.target.value)}
                />
              </Field>
              <Field
                label="Publish Time"
                htmlFor="wf-publish-time"
                required
                error={fieldErrors.publishTime}
              >
                <input
                  id="wf-publish-time"
                  type="time"
                  className={inputClass(Boolean(fieldErrors.publishTime))}
                  value={form.publishTime}
                  onChange={(e) => set("publishTime", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          <InfoNote>
            {scheduling
              ? "Times are Jakarta local time. The workout stays Scheduled and hidden from members until that moment, then the backend releases it."
              : "Saving never publishes on its own — the mode chosen above decides."}
          </InfoNote>
        </fieldset>

        <FormError message={error} />
      </form>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onClose} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <SubmitButton submitting={submitting} form="workout-form">
          <i className="fas fa-save" aria-hidden />
          {workout ? "Save Changes" : "Save Workout"}
        </SubmitButton>
      </div>
    </Modal>
  );
}
