"use client";

import {
  WEEKDAYS,
  describeRecurrence,
  isRepeating,
  weekdayOf,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from "@/lib/classes/recurrence";

type Props = {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  /** The date the series starts from (`YYYY-MM-DD`): Begin Date or Effective From. */
  startDate: string;
  disabled?: boolean;
  /**
   * Offer "Does not repeat". Off when editing a series from a date on, where
   * the rule itself is what is being changed.
   */
  allowNone?: boolean;
};

const FREQUENCIES: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "daily", label: "Daily" },
];

const inputClass =
  "w-full bg-sidebar border border-border text-fg px-4 py-2.5 rounded-lg focus:outline-none focus:border-sweat disabled:opacity-50";

/** Recurrence controls for the class form: repeat, repeat on, ends. */
export function RecurrenceFields({
  value,
  onChange,
  startDate,
  disabled,
  allowNone = true,
}: Props) {
  const repeating = isRepeating(value);
  const showDays = value.frequency === "weekly" || value.frequency === "biweekly";

  function toggleDay(day: number) {
    const next = value.daysOfWeek.includes(day)
      ? value.daysOfWeek.filter((d) => d !== day)
      : [...value.daysOfWeek, day].sort((a, b) => a - b);
    onChange({ ...value, daysOfWeek: next });
  }

  function setFrequency(frequency: RecurrenceFrequency) {
    // Seed weekly rules with the Begin Date's weekday.
    const startDay = weekdayOf(startDate);
    const seed =
      value.daysOfWeek.length > 0 || startDay == null ? value.daysOfWeek : [startDay];
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

      <div>
        <label className="block text-muted text-xs mb-1">Repeat</label>
        <select
          value={value.frequency}
          onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
          disabled={disabled}
          className={inputClass}
        >
          {FREQUENCIES.filter((f) => allowNone || f.value !== "none").map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

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
          <p className="text-muted text-xs mb-1.5">Ends</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-fg">
              <label className="flex items-center gap-2 shrink-0">
                <input
                  type="radio"
                  name="recurrence-ends"
                  checked={!value.noEndDate}
                  onChange={() => onChange({ ...value, noEndDate: false })}
                  disabled={disabled}
                  className="accent-sweat"
                />
                On date
              </label>
              <input
                type="date"
                aria-label="End date"
                value={value.until ?? ""}
                min={startDate || undefined}
                onChange={(e) =>
                  onChange({ ...value, until: e.target.value, noEndDate: false })
                }
                onFocus={() => {
                  if (value.noEndDate) onChange({ ...value, noEndDate: false });
                }}
                disabled={disabled}
                style={{ colorScheme: "dark" }}
                className={`${inputClass} py-2 ${value.noEndDate ? "opacity-50" : ""}`}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="radio"
                name="recurrence-ends"
                checked={value.noEndDate}
                onChange={() => onChange({ ...value, noEndDate: true })}
                disabled={disabled}
                className="accent-sweat"
              />
              No end date
            </label>
          </div>
        </div>
      )}

      {repeating && startDate && (
        <p className="text-[11px] text-muted">
          <i className="fas fa-info-circle mr-1.5 text-accent-ink" aria-hidden />
          {describeRecurrence(value, startDate)}
          {value.noEndDate && (
            <span className="block mt-1">
              Classes are created a few weeks ahead and added automatically.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
