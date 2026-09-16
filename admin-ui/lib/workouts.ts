import type { BadgeTone } from "@/components/ui/badge";

/**
 * The workout module's contract with the API.
 *
 * Field names mirror `WorkoutResponse`, `CreateWorkoutRequest` and
 * `UpdateWorkoutRequest` exactly, so a form payload goes to the wire without a
 * translation layer.
 */

/** The release choices the backend's `WorkoutPublishModes` accepts. */
export const PUBLISH_MODES = {
  draft: "Draft",
  publishNow: "PublishNow",
  schedule: "Schedule",
} as const;

export type PublishMode = (typeof PUBLISH_MODES)[keyof typeof PUBLISH_MODES];

export const WORKOUT_STATUSES = [
  "Draft",
  "Scheduled",
  "Published",
  "Archived",
] as const;

export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export type Workout = {
  id: string;
  title: string;
  classScheduleId?: string | null;
  className?: string | null;
  classDate?: string | null;
  classStartTime?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  coachName?: string | null;
  workoutDate: string;
  content: string;
  /** The state as stored. */
  status: string;
  /**
   * The state as it reads now: a scheduled workout past its moment reports
   * `Published` here while `status` still says `Scheduled`. The list shows this
   * one, because it is what a member would see.
   */
  effectiveStatus: string;
  isVisibleToMembers: boolean;
  /** Jakarta wall clock, already converted by the API. */
  publishAt?: string | null;
  publishedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type WorkoutRequest = {
  title: string;
  classScheduleId: string | null;
  workoutDate: string | null;
  branchId: string | null;
  content: string;
  publishMode: PublishMode;
  publishAt: string | null;
};

const STATUS_TONE: Record<string, BadgeTone> = {
  Draft: "neutral",
  Scheduled: "warning",
  Published: "success",
  Archived: "danger",
};

const STATUS_ICON: Record<string, string> = {
  Draft: "fa-pen",
  Scheduled: "fa-clock",
  Published: "fa-circle-check",
  Archived: "fa-box-archive",
};

export function statusTone(status: string): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}

export function statusIcon(status: string): string {
  return STATUS_ICON[status] ?? "fa-circle";
}

/**
 * How a status reads to staff.
 *
 * "Scheduled" on its own has been read as "already out" before, so the
 * scheduled state says plainly that members cannot see it yet.
 */
export function statusDescription(workout: Workout): string {
  switch (workout.effectiveStatus) {
    case "Draft":
      return "Not visible to members. Publish when it is ready.";
    case "Scheduled":
      return "Waiting for its publish time. Members cannot see it yet.";
    case "Published":
      return "Visible to members now.";
    case "Archived":
      return "Superseded. Kept for history and never shown to members.";
    default:
      return "";
  }
}

/** The publish mode an existing workout should reopen on. */
export function modeFromStatus(status: string): PublishMode {
  if (status === "Published") return PUBLISH_MODES.publishNow;
  if (status === "Scheduled") return PUBLISH_MODES.schedule;
  return PUBLISH_MODES.draft;
}

/** A one-line summary of a workout's class, for a table cell. */
export function classLabel(workout: Workout): string {
  if (!workout.className) return "Unassigned";
  const time = workout.classStartTime
    ? ` ${workout.classStartTime.slice(0, 5)}`
    : "";
  return `${workout.className}${time}`;
}
