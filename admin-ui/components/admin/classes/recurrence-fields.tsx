"use client";

import {
  WEEKDAYS,
  describeRecurrence,
  expandRecurrence,
  isRepeating,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from "@/lib/classes/recurrence";

type Props = {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  /** The class date the series starts from (`YYYY-MM-DD`). */
  startDate: string;
  disabled?: boolean;
};

const FREQUENCIES: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
];

/** Recurrence controls for the create-class form. */
export function RecurrenceFields({ value, onChange, startDate, disabled }: Props) {
  const repeating = isRepeating(value);
  const showDays = value.frequency === "weekly" || value.frequency === "biweekly";
  const preview = repeating && startDate ? expandRecurrence(value, startDate) : [];

  function toggleDay(day: number) {
    const next = value.daysOfWeek.includes(day)
      ? value.daysOfWeek.filter((d) => d !== day)
      : [...value.daysOfWeek, day].sort((a, b) => a - b);
    onChange({ ...value, daysOfWeek: next });
  }

  function setFrequency(frequency: RecurrenceFrequency) {
    // Seed weekly rules with the weekday the staff already picked.
    const seed =
      value.daysOfWeek.length > 0 || !startDate
        ? value.daysOfWeek
        : [new Date(`${startDate}T00:00:00`).getDay()];
    onChange({ ...value, frequency, daysOfWeek: frequency === "daily" ? [] : seed });
  }

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-sidebar/40">
      <div className="flex items-center gap-2">
        <i className="fas fa-repeat text-accent-ink text-sm" aria-hidden />
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Recurrence
        </span>
      </div>

      <select
        value={value.frequency}
        onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
        disabled={disabled}
        className="w-full bg-sidebar border border-border text-fg px-4 py-2.5 rounded-lg focus:outline-none focus:border-sweat disabled:opacity-50"
      >
        {FREQUENCIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {showDays && (
        <div>
          <p className="text-muted text-xs mb-1.5">Repeat on</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const active = value.daysOfWeek.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  disabled={disabled}
                  aria-pressed={active}
                  title={d.label}
                  className={`w-11 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-50 ${
                    active
                      ? "bg-sweat text-black border-sweat"
                      : "bg-sidebar border-border text-muted hover:text-fg"
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {repeating && (
        <div>
          <label className="block text-muted text-xs mb-1">
            Repeat until <span className="text-danger">*</span>
          </label>
          <input
            type="date"
            value={value.until}
            min={startDate || undefined}
            onChange={(e) => onChange({ ...value, until: e.target.value })}
            disabled={disabled}
            style={{ colorScheme: "dark" }}
            className="w-full bg-sidebar border border-border text-fg px-4 py-2.5 rounded-lg focus:outline-none focus:border-sweat disabled:opacity-50"
          />
        </div>
      )}

      {repeating && startDate && (
        <p className="text-[11px] text-muted">
          <i className="fas fa-info-circle mr-1.5 text-accent-ink" aria-hidden />
          {describeRecurrence(value, startDate)}
          {preview.length > 0 && (
            <span className="block text-muted mt-1">
              Mulai {new Date(`${preview[0]}T00:00:00`).toLocaleDateString("id-ID")}
              {preview.length > 1 &&
                ` · terakhir ${new Date(
                  `${preview[preview.length - 1]}T00:00:00`
                ).toLocaleDateString("id-ID")}`}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
