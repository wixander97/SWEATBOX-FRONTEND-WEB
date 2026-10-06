"use client";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Field, inputClass } from "@/components/ui/field";
import { todayInJakarta, toDateInput } from "@/lib/format";

/** A settings value's `yyyy-MM-dd`, or "" for none. */
export function settingDate(value: string | null | undefined): string {
  return toDateInput(value);
}

/**
 * Where a dated programme stands right now, from the values the backend
 * returned (`isEnabled`, `isActiveNow`, start/end dates).
 */
export function programStatus(s: {
  isEnabled: boolean;
  isActiveNow?: boolean;
  startDate: string | null;
  endDate: string | null;
}): { label: string; tone: BadgeTone; icon: string } {
  if (!s.isEnabled) return { label: "Off", tone: "neutral", icon: "fa-power-off" };
  if (s.isActiveNow) return { label: "Active now", tone: "success", icon: "fa-circle-check" };
  const today = todayInJakarta();
  const start = settingDate(s.startDate);
  const end = settingDate(s.endDate);
  if (start && start > today) return { label: "Scheduled", tone: "info", icon: "fa-clock" };
  if (end && end < today) return { label: "Ended", tone: "warning", icon: "fa-flag-checkered" };
  return { label: "Inactive", tone: "neutral", icon: "fa-circle-pause" };
}

export function ProgramStatusPill(props: Parameters<typeof programStatus>[0]) {
  const status = programStatus(props);
  return (
    <Badge tone={status.tone} icon={status.icon}>
      {status.label}
    </Badge>
  );
}

/** The required "Reason for change" input every audited settings form carries. */
export function ReasonField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  return (
    <Field
      label="Reason for change"
      htmlFor={id}
      required
      error={error}
      hint="Recorded in the change history with your name."
    >
      <textarea
        id={id}
        rows={2}
        maxLength={500}
        className={inputClass(Boolean(error))}
        placeholder="e.g. October campaign, approved by management"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** A start date and an end date with a "No end date" switch. */
export function DateRangeFields({
  idPrefix,
  startLabel,
  endLabel,
  start,
  end,
  noEnd,
  disabled,
  onStart,
  onEnd,
  onNoEnd,
}: {
  idPrefix: string;
  startLabel: string;
  endLabel: string;
  start: string;
  end: string;
  noEnd: boolean;
  disabled?: boolean;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onNoEnd: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label={startLabel} htmlFor={`${idPrefix}-start`} hint="Leave empty to start immediately.">
        <input
          id={`${idPrefix}-start`}
          type="date"
          disabled={disabled}
          className={inputClass()}
          value={start}
          onChange={(e) => onStart(e.target.value)}
        />
      </Field>
      <Field label={endLabel} htmlFor={`${idPrefix}-end`}>
        <input
          id={`${idPrefix}-end`}
          type="date"
          disabled={disabled || noEnd}
          className={inputClass()}
          value={noEnd ? "" : end}
          min={start || undefined}
          onChange={(e) => onEnd(e.target.value)}
        />
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={noEnd}
            disabled={disabled}
            onChange={(e) => onNoEnd(e.target.checked)}
            className="w-4 h-4 accent-[#ffd700]"
          />
          No end date
        </label>
      </Field>
    </div>
  );
}

/** Loading / failed placeholders shared by the settings tabs. */
export function SettingsLoading() {
  return (
    <div className="flex items-center justify-center gap-3 text-muted text-sm py-10">
      <i className="fas fa-circle-notch fa-spin text-accent-ink" aria-hidden />
      Loading…
    </div>
  );
}

export function SettingsLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-fg bg-fg/5 hover:bg-fg/10 border border-border px-4 py-2 rounded-lg"
      >
        Try again
      </button>
    </div>
  );
}
