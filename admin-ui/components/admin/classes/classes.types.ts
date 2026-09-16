import type {
  AssistantCoach,
  AssistantCoachAssignment,
} from "@/lib/class-schedules";

export type ApiClass = {
  id: string;
  className: string;
  coachId: string;
  coachName?: string | null;
  branchId: string;
  branchName?: string | null;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount?: number;
  remainingSlots?: number;
  roomName?: string | null;
  description?: string | null;
  classType?: string | null;
  difficultyLevel?: string | null;
  isActive: boolean;
  isCancelled?: boolean;
  cancelReason?: string | null;
  isCompleted?: boolean;
  isSessionActive?: boolean;
  createdAt?: string;
  updatedAt?: string | null;
  /** Assistants on this occurrence, each with the tier they are paid at. */
  assistantCoaches?: AssistantCoach[] | null;
  /** The primary coach's rate tier; null means the branch default applies. */
  coachRateTierId?: string | null;
  coachRateTierName?: string | null;
  /** The workout attached to this occurrence, when one exists. */
  workoutId?: string | null;
  workoutTitle?: string | null;
  workoutStatus?: string | null;
};

export type ApiCoach = {
  id: string;
  fullName?: string | null;
  name?: string | null;
};

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
  assistantCoaches?: AssistantCoachAssignment[];
  coachRateTierId?: string | null;
};

export type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  pageSize?: number;
  message?: string;
};

export function classToFormValues(c: ApiClass): Partial<ClassFormValues> {
  return {
    className: c.className,
    coachId: c.coachId,
    classDate: c.classDate,
    startTime: c.startTime,
    endTime: c.endTime,
    capacity: c.capacity,
    branchId: c.branchId || "",
    roomName: c.roomName || "",
    description: c.description || "",
    classType: c.classType || "",
    difficultyLevel: c.difficultyLevel || "",
    assistantCoaches: toAssistantAssignments(c),
    coachRateTierId: c.coachRateTierId ?? null,
  };
}

/** The assistants on a loaded class, in the shape a create/update request sends. */
export function toAssistantAssignments(c: ApiClass): AssistantCoachAssignment[] {
  return (c.assistantCoaches ?? []).map((assistant) => ({
    coachId: assistant.coachId,
    coachRateTierId: assistant.coachRateTierId ?? null,
  }));
}