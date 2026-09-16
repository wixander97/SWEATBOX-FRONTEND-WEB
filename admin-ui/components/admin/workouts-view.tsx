"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkoutFormModal } from "@/components/admin/workout-form-modal";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
import { Modal } from "@/components/ui/modal";
import { FIELD_CLASS } from "@/components/ui/field";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  PanelCard,
} from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { apiRequest, errorMessage, readPage } from "@/lib/api/client";
import { useRole } from "@/contexts/role-context";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import type { Branch } from "@/lib/branches";
import type { ClassSchedule } from "@/lib/class-schedules";
import {
  WORKOUT_STATUSES,
  classLabel,
  statusDescription,
  statusIcon,
  statusTone,
  type Workout,
  type WorkoutRequest,
} from "@/lib/workouts";

/**
 * The workout list: everything programmed, and what state each piece is in.
 *
 * The status column shows the *effective* status the API reports rather than
 * the stored one. A workout scheduled for six this morning is published now,
 * and a list that still called it "Scheduled" would have staff re-publishing
 * something members are already reading.
 */

const PAGE_SIZE = 10;
const COLUMNS = 8;

type Filters = {
  search: string;
  status: string;
  branchId: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  status: "",
  branchId: "",
  startDate: "",
  endDate: "",
};

export function WorkoutsView() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("workout.write");

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [viewing, setViewing] = useState<Workout | null>(null);
  const [archiving, setArchiving] = useState<Workout | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Typing in the search box should not fire a request per keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<unknown>("/api/workouts", {
        query: {
          page,
          pageSize: PAGE_SIZE,
          search: filters.search,
          status: filters.status,
          branchId: filters.branchId,
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      });
      const result = readPage<Workout>(
        payload as Parameters<typeof readPage<Workout>>[0],
        PAGE_SIZE
      );
      setWorkouts(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(errorMessage(err));
      setWorkouts([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const data = await apiRequest<Branch[]>("/api/branches");
        setBranches(Array.isArray(data) ? data : []);
      } catch {
        // The branch filter is a convenience; the list still works without it.
        setBranches([]);
      }

      try {
        const payload = await apiRequest<unknown>("/api/classes/options");
        const page = readPage<ClassSchedule>(
          payload as Parameters<typeof readPage<ClassSchedule>>[0],
          200
        );
        // Newest first: a workout is usually written for a class close to now.
        setClasses(
          [...page.items].sort((a, b) =>
            (b.classDate ?? "").localeCompare(a.classDate ?? "")
          )
        );
      } catch {
        setClasses([]);
      } finally {
        setClassesLoading(false);
      }
    }
    void loadReferenceData();
  }, []);

  const hasFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          filters.status ||
          filters.branchId ||
          filters.startDate ||
          filters.endDate
      ),
    [filters]
  );

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setPage(1);
  }

  async function saveWorkout(values: WorkoutRequest) {
    if (editing) {
      await apiRequest<Workout>(`/api/workouts/${editing.id}`, {
        method: "PUT",
        body: values,
      });
      toast.success("Workout updated.");
    } else {
      await apiRequest<Workout>("/api/workouts", {
        method: "POST",
        body: values,
      });
      toast.success(
        "Workout saved.",
        values.publishMode === "PublishNow"
          ? "It is visible to members now."
          : values.publishMode === "Schedule"
            ? "It will be released at the scheduled time."
            : "Saved as a draft — members cannot see it yet."
      );
    }
    await load();
  }

  /** Publish, unpublish and archive all post to their own endpoint. */
  async function runAction(
    workout: Workout,
    action: "publish" | "unpublish" | "archive",
    successMessage: string
  ) {
    setBusyId(workout.id);
    try {
      await apiRequest(`/api/workouts/${workout.id}/${action}`, {
        method: "POST",
      });
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error("Could not update the workout", errorMessage(err));
    } finally {
      setBusyId(null);
      setArchiving(null);
    }
  }

  return (
    <div className="space-y-4">
      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold font-display uppercase text-fg">
                Workouts
              </h3>
              <p className="text-xs text-muted mt-1">
                One workout per class occurrence. The same recurring class can
                run a different workout every day.
              </p>
            </div>
            {canWrite ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full lg:w-auto"
              >
                <i className="fas fa-plus" aria-hidden />
                Create Workout
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <i
                className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm"
                aria-hidden
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search title or class"
                aria-label="Search workouts"
                className={`${FIELD_CLASS} !py-2 !pl-9 text-sm`}
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              aria-label="Filter by status"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              <option value="">All statuses</option>
              {WORKOUT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={filters.branchId}
              onChange={(e) => setFilter("branchId", e.target.value)}
              aria-label="Filter by branch"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branchName}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilter("startDate", e.target.value)}
              aria-label="Workouts from date"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilter("endDate", e.target.value)}
              aria-label="Workouts to date"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            />
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted hover:text-fg self-start"
            >
              <i className="fas fa-times mr-1.5" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4">Workout Title</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Publish At</th>
                <th className="px-6 py-4">Published At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <LoadingState colSpan={COLUMNS} />
              ) : error ? (
                <ErrorState
                  colSpan={COLUMNS}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : workouts.length === 0 ? (
                <EmptyState
                  colSpan={COLUMNS}
                  icon="fa-dumbbell"
                  title={hasFilters ? "No workouts match" : "No workouts yet"}
                  description={
                    hasFilters
                      ? "Try widening the date range or clearing the filters."
                      : "Create the first workout to programme a class."
                  }
                />
              ) : (
                workouts.map((workout) => {
                  const status = workout.effectiveStatus || workout.status;
                  const busy = busyId === workout.id;
                  return (
                    <tr key={workout.id} className="table-row transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-fg font-bold">
                          {formatDate(workout.workoutDate)}
                        </span>
                        {workout.classStartTime ? (
                          <span className="block text-xs text-muted">
                            {formatTime(workout.classStartTime)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-fg">{classLabel(workout)}</span>
                        {workout.coachName ? (
                          <span className="block text-xs text-muted">
                            {workout.coachName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-fg/10 px-2 py-1 rounded text-xs text-fg-soft">
                          {workout.branchName || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-fg font-medium">
                        {workout.title}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          tone={statusTone(status)}
                          icon={statusIcon(status)}
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {formatDateTime(workout.publishAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {formatDateTime(workout.publishedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewing(workout)}
                            className="text-muted hover:text-fg px-2 py-1"
                            aria-label={`View ${workout.title}`}
                            title="View"
                          >
                            <i className="fas fa-eye" aria-hidden />
                          </button>

                          {canWrite ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(workout);
                                  setFormOpen(true);
                                }}
                                disabled={busy}
                                className="text-muted hover:text-fg px-2 py-1 disabled:opacity-40"
                                aria-label={`Edit ${workout.title}`}
                                title="Edit"
                              >
                                <i className="fas fa-edit" aria-hidden />
                              </button>

                              {status !== "Published" &&
                              status !== "Archived" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runAction(
                                      workout,
                                      "publish",
                                      "Workout published."
                                    )
                                  }
                                  disabled={busy}
                                  className="text-success hover:text-success px-2 py-1 disabled:opacity-40"
                                  aria-label={`Publish ${workout.title}`}
                                  title="Publish now"
                                >
                                  <i
                                    className={`fas ${busy ? "fa-circle-notch fa-spin" : "fa-paper-plane"}`}
                                    aria-hidden
                                  />
                                </button>
                              ) : null}

                              {status === "Published" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runAction(
                                      workout,
                                      "unpublish",
                                      "Workout returned to draft."
                                    )
                                  }
                                  disabled={busy}
                                  className="text-warning hover:opacity-80 px-2 py-1 disabled:opacity-40"
                                  aria-label={`Unpublish ${workout.title}`}
                                  title="Unpublish"
                                >
                                  <i
                                    className={`fas ${busy ? "fa-circle-notch fa-spin" : "fa-eye-slash"}`}
                                    aria-hidden
                                  />
                                </button>
                              ) : null}

                              {status !== "Archived" ? (
                                <button
                                  type="button"
                                  onClick={() => setArchiving(workout)}
                                  disabled={busy}
                                  className="text-muted hover:text-danger px-2 py-1 disabled:opacity-40"
                                  aria-label={`Archive ${workout.title}`}
                                  title="Archive"
                                >
                                  <i className="fas fa-box-archive" aria-hidden />
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          loading={loading}
          onChange={setPage}
          label="workouts"
        />
      </PanelCard>

      <WorkoutFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        workout={editing}
        classes={classes}
        classesLoading={classesLoading}
        onSubmit={saveWorkout}
      />

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing?.title ?? "Workout"}
        subtitle={
          viewing
            ? `${formatDate(viewing.workoutDate)} • ${classLabel(viewing)}${
                viewing.branchName ? ` • ${viewing.branchName}` : ""
              }`
            : undefined
        }
      >
        {viewing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={statusTone(viewing.effectiveStatus)}
                icon={statusIcon(viewing.effectiveStatus)}
              >
                {viewing.effectiveStatus}
              </Badge>
              <span className="text-xs text-muted">
                {statusDescription(viewing)}
              </span>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <dt className="text-muted">Publish at</dt>
                <dd className="text-fg mt-0.5">
                  {formatDateTime(viewing.publishAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Published at</dt>
                <dd className="text-fg mt-0.5">
                  {formatDateTime(viewing.publishedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Created by</dt>
                <dd className="text-fg mt-0.5 break-all">
                  {viewing.createdBy || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last updated by</dt>
                <dd className="text-fg mt-0.5 break-all">
                  {viewing.updatedBy || "-"}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-muted text-sm mb-1">Workout Content</p>
              <pre className="bg-sidebar border border-border rounded-lg p-4 text-sm text-fg-soft whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                {viewing.content}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archive this workout?"
        destructive
        confirmLabel="Archive"
        busy={busyId === archiving?.id}
        message={
          <>
            <strong className="text-fg">{archiving?.title}</strong> will stop
            being shown to members and cannot be published again. Archiving also
            frees its class occurrence to receive a replacement workout.
          </>
        }
        onCancel={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) {
            void runAction(archiving, "archive", "Workout archived.");
          }
        }}
      />

      {!canWrite ? (
        <p className="text-xs text-muted">
          <i className="fas fa-lock mr-1.5" aria-hidden />
          Your role can view workouts but not change them.
        </p>
      ) : null}
    </div>
  );
}
