"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import { bookedCountOf, listClassSchedules, type ApiClass } from "@/lib/api/classes";
import { coachLabel, listCoaches, type Coach } from "@/lib/api/coaches";
import { branchLabel, listBranches, type Branch } from "@/lib/api/branches";
import { formatDateOnly } from "@/lib/classes/recurrence";

type CalendarView = "month" | "week" | "day";

type Props = {
  onSelect: (cls: ApiClass) => void;
  /** Bumped by the parent after a create/edit/delete so the calendar refetches. */
  refreshKey?: number;
};

const VIEWS: Array<{ key: CalendarView; label: string }> = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Inclusive day range covered by the current view. */
function rangeFor(view: CalendarView, anchor: Date): Date[] {
  if (view === "day") {
    const d = new Date(anchor);
    d.setHours(0, 0, 0, 0);
    return [d];
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function titleFor(view: CalendarView, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString(
      "id-ID",
      { day: "2-digit", month: "short", year: "numeric" }
    )}`;
  }
  return anchor.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function eventTone(c: ApiClass): string {
  if (c.isCancelled) return "border-red-500/40 bg-red-500/10 hover:bg-red-500/15";
  if (c.isCompleted) return "border-border bg-gray-500/10 hover:bg-gray-500/15";
  return "border-sweat/40 bg-sweat/10 hover:bg-sweat/20";
}

function EventChip({ c, onSelect }: { c: ApiClass; onSelect: (c: ApiClass) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      className={`w-full text-left rounded-md border px-2 py-1 transition ${eventTone(c)}`}
      title={`${c.className} · ${c.coachName ?? "-"}`}
    >
      <span className="block text-[11px] font-bold text-fg leading-tight">
        {c.startTime?.slice(0, 5) ?? "--:--"}
      </span>
      <span className="block text-[11px] text-fg-soft truncate">{c.className}</span>
      <span className="block text-[10px] text-muted truncate">{c.coachName ?? "-"}</span>
      <span className="block text-[10px] text-accent-ink">
        {bookedCountOf(c)} / {c.capacity ?? 0}
      </span>
    </button>
  );
}

/**
 * Month / week / day calendar over the existing class schedules.
 *
 * Fetches the full schedule list once (the same endpoint the table export uses)
 * and buckets it by date client-side, so navigating between months is instant.
 */
export function ClassCalendar({ onSelect, refreshKey = 0 }: Props) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [coachFilter, setCoachFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listClassSchedules();
      setClasses(list);
    } catch (err) {
      setError(errorMessageOf(err, "Gagal memuat class schedule"));
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listCoaches(), listBranches()]).then(([c, b]) => {
      if (cancelled) return;
      if (c.status === "fulfilled") setCoaches(c.value);
      if (b.status === "fulfilled") setBranches(b.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const classNames = useMemo(
    () => Array.from(new Set(classes.map((c) => c.className).filter(Boolean))).sort(),
    [classes]
  );

  const filtered = useMemo(
    () =>
      classes.filter((c) => {
        if (coachFilter && c.coachId !== coachFilter) return false;
        if (branchFilter && c.branchId !== branchFilter) return false;
        if (classFilter && c.className !== classFilter) return false;
        return true;
      }),
    [classes, coachFilter, branchFilter, classFilter]
  );

  /** date (YYYY-MM-DD) -> classes, sorted by start time. */
  const byDate = useMemo(() => {
    const map = new Map<string, ApiClass[]>();
    for (const c of filtered) {
      if (!c.classDate) continue;
      const key = c.classDate.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) bucket.push(c);
      else map.set(key, [c]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }
    return map;
  }, [filtered]);

  const days = rangeFor(view, anchor);
  const todayKey = formatDateOnly(new Date());
  const currentMonth = anchor.getMonth();

  function shift(direction: -1 | 1) {
    setAnchor((current) => {
      const next = new Date(current);
      if (view === "month") next.setMonth(next.getMonth() + direction);
      else if (view === "week") next.setDate(next.getDate() + 7 * direction);
      else next.setDate(next.getDate() + direction);
      return next;
    });
  }

  const filterSelectClass =
    "bg-sidebar border border-border text-fg px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-sweat";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="w-9 h-9 rounded-lg bg-sidebar border border-border text-fg-soft hover:text-fg"
            aria-label="Previous"
          >
            <i className="fas fa-chevron-left" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="px-3 h-9 rounded-lg bg-sidebar border border-border text-xs font-bold text-fg-soft hover:text-fg"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="w-9 h-9 rounded-lg bg-sidebar border border-border text-fg-soft hover:text-fg"
            aria-label="Next"
          >
            <i className="fas fa-chevron-right" aria-hidden />
          </button>
          <h3 className="ml-2 text-base sm:text-lg font-bold font-display uppercase text-fg">
            {titleFor(view, anchor)}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            className={filterSelectClass}
          >
            <option value="">All coaches</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {coachLabel(c)}
              </option>
            ))}
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className={filterSelectClass}
          >
            <option value="">All classes</option>
            {classNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className={filterSelectClass}
          >
            <option value="">All locations</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchLabel(b)}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                  view === v.key
                    ? "bg-sweat text-black border-sweat"
                    : "bg-sidebar border-border text-muted hover:text-fg"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-sweat border-t-transparent" />
          <p className="text-sm text-muted mt-3">Memuat kalender...</p>
        </div>
      ) : view === "day" ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-sidebar px-4 py-2 text-xs font-bold uppercase text-muted">
            {DAY_LABELS[days[0].getDay()]}
          </div>
          <div className="p-3 space-y-2 min-h-[240px]">
            {(byDate.get(formatDateOnly(days[0])) ?? []).length === 0 ? (
              <p className="text-sm text-muted text-center py-10">
                Tidak ada class pada hari ini.
              </p>
            ) : (
              (byDate.get(formatDateOnly(days[0])) ?? []).map((c) => (
                <EventChip key={c.id} c={c} onSelect={onSelect} />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-t-lg overflow-hidden">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="bg-sidebar px-2 py-2 text-[11px] font-bold uppercase text-muted text-center"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border border border-t-0 border-border rounded-b-lg overflow-hidden">
              {days.map((day) => {
                const key = formatDateOnly(day);
                const events = byDate.get(key) ?? [];
                const outside = view === "month" && day.getMonth() !== currentMonth;
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`bg-card p-1.5 space-y-1 ${
                      view === "month" ? "min-h-[112px]" : "min-h-[220px]"
                    } ${outside ? "opacity-40" : ""}`}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-[11px] font-bold ${
                          isToday
                            ? "bg-sweat text-black rounded px-1.5"
                            : "text-muted"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {events.length > 0 && (
                        <span className="text-[10px] text-muted">{events.length}</span>
                      )}
                    </div>
                    {(view === "month" ? events.slice(0, 3) : events).map((c) => (
                      <EventChip key={c.id} c={c} onSelect={onSelect} />
                    ))}
                    {view === "month" && events.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnchor(day);
                          setView("day");
                        }}
                        className="w-full text-[10px] text-muted hover:text-accent-ink text-left px-1"
                      >
                        +{events.length - 3} lainnya
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
