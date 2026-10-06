"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreateClassModal,
  type ClassFormValues,
  type SeriesScope,
} from "./create-class-modal";
import { authFetch } from "@/lib/auth/client-fetch";
import { API_BASE_URL } from "@/lib/auth/constants";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { classToFormValues, type ApiClass } from "./classes.types";
import {
  endClassSeries,
  getClassSeries,
  seriesToRecurrence,
  updateClassSeries,
} from "@/lib/api/classes";
import { errorMessageOf } from "@/lib/api/http";
import { formatDateOnly, type RecurrenceRule } from "@/lib/classes/recurrence";
import { ConfirmDialog } from "@/components/ui/modal";

type Props = {
  cls: ApiClass | null;
  open: boolean;
  onClose: () => void;
  trainerOptions: Array<{ id: string; name: string }>;
  /** Called after a save; series changes pass the backend's summary. */
  onSuccess: (message?: string) => void;
  /** Opens the workout for this occurrence, when the viewer may write one. */
  onManageWorkout?: (cls: ApiClass) => void;
};

export function EditClassModal({
  cls,
  open,
  onClose,
  trainerOptions,
  onSuccess,
  onManageWorkout,
}: Props) {
  const seriesId = cls?.seriesId ?? null;
  const occurrenceDate = cls?.classDate ? cls.classDate.slice(0, 10) : "";
  const [seriesRule, setSeriesRule] = useState<RecurrenceRule | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState("");
  const [endOpen, setEndOpen] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  // A series occurrence offers "This and following": load the rule it repeats on.
  useEffect(() => {
    setSeriesRule(null);
    setSeriesError("");
    if (!open || !seriesId) return;
    const controller = new AbortController();
    setSeriesLoading(true);
    getClassSeries(seriesId, { signal: controller.signal })
      .then((series) => setSeriesRule(seriesToRecurrence(series)))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSeriesError(errorMessageOf(err, "Failed to load recurring class"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSeriesLoading(false);
      });
    return () => controller.abort();
  }, [open, seriesId]);

  const handleSubmit = useCallback(
    async (values: ClassFormValues, recurrence?: RecurrenceRule, scope?: SeriesScope) => {
      if (!cls) return;
      if (scope && cls.seriesId && recurrence) {
        // This and following: the backend rewrites the series from Effective From.
        const result = await updateClassSeries(
          cls.seriesId,
          values,
          recurrence,
          scope.effectiveFrom
        );
        onSuccess(result.message || "Recurring class updated.");
        return;
      }
      const res = await authFetch(`${API_BASE_URL}/api/v1/class-schedules/${cls.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(payload.message || "Failed to update class");
      }
      onSuccess();
    },
    [cls, onSuccess]
  );

  async function confirmEnd() {
    if (!seriesId) return;
    if (!endDate) {
      setEndError("Choose the last date the class runs.");
      return;
    }
    setEnding(true);
    setEndError("");
    try {
      const result = await endClassSeries(seriesId, endDate);
      setEndOpen(false);
      onClose();
      onSuccess(result.message || "Recurring class ended.");
    } catch (err) {
      setEndError(errorMessageOf(err, "Failed to end recurring class"));
    } finally {
      setEnding(false);
    }
  }

  // Stable per class: the form resets whenever this object changes.
  const initialValues = useMemo(() => (cls ? classToFormValues(cls) : undefined), [cls]);

  const seriesEdit = seriesId
    ? {
        occurrenceDate,
        recurrence: seriesRule,
        loading: seriesLoading,
        error: seriesError,
        onEndRepeating: () => {
          const today = formatDateOnly(new Date());
          setEndDate(occurrenceDate > today ? occurrenceDate : today);
          setEndError("");
          setEndOpen(true);
        },
      }
    : undefined;

  return (
    <>
      <CreateClassModal
        open={open}
        onClose={onClose}
        title="Edit Class"
        submitLabel="Save Changes"
        allowRateOverride
        initialValues={initialValues}
        trainerOptions={trainerOptions}
        seriesEdit={seriesEdit}
        onManageWorkout={
          cls && onManageWorkout ? () => onManageWorkout(cls) : undefined
        }
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={endOpen}
        title="End Repeating"
        confirmLabel="End repeating"
        destructive
        busy={ending}
        onCancel={() => setEndOpen(false)}
        onConfirm={() => void confirmEnd()}
        message={
          <div className="space-y-3">
            <p>
              The class stops repeating after the last date. Later classes nobody has
              booked are removed; classes with bookings are kept.
            </p>
            <div>
              <label className="block text-muted text-sm mb-1" htmlFor="series-last-date">
                Last date <span className="text-danger">*</span>
              </label>
              <input
                id="series-last-date"
                type="date"
                value={endDate}
                min={formatDateOnly(new Date())}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
              />
            </div>
            {endError && <p className="text-sm text-danger">{endError}</p>}
          </div>
        }
      />
    </>
  );
}
