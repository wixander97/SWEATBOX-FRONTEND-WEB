export type Coach = {
  id: string;
  fullName?: string | null;
  name?: string | null;
};

export type Branch = {
  id: string;
  branchName?: string | null;
  name?: string | null;
  isActive?: boolean;
};

export type Member = {
  id: string;
  fullName?: string | null;
  name?: string | null;
  memberCode?: string | null;
};

export type PtPackage = {
  id: string;
  name: string;
  memberId?: string | null;
  memberName?: string | null;
  coachId?: string | null;
  coachName?: string | null;
  sessionCount?: number;
  price?: number;
  isActive?: boolean;
  description?: string | null;
};

export type PtSessionParticipant = {
  memberId?: string | null;
  memberName?: string | null;
};

export type PtSession = {
  id: string;
  ptPackageId?: string | null;
  packageName?: string | null;
  coachId?: string | null;
  coachName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  sessionDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  trainingType?: string | null;
  maxParticipants?: number;
  notes?: string | null;
  status?: string | null;
  participants?: PtSessionParticipant[];
  participantCount?: number;
};

export type SelectOption = { id: string; label: string };

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

export function parseList<T>(payload: T[] | PagedResponse<T>): T[] {
  if (Array.isArray(payload)) return payload;
  return payload.items || payload.data || [];
}

export function parseTotal<T>(
  payload: T[] | PagedResponse<T>,
  list: T[],
  fallbackPageSize: number
): { totalItems: number; totalPages: number } {
  if (Array.isArray(payload)) {
    return { totalItems: payload.length, totalPages: 1 };
  }
  const totalItems =
    payload.totalCount ?? payload.totalItems ?? payload.total ?? list.length;
  const totalPages =
    payload.totalPages ??
    payload.pageCount ??
    Math.max(1, Math.ceil(totalItems / (payload.pageSize ?? fallbackPageSize)));
  return { totalItems, totalPages };
}

export function coachLabel(c: Coach): string {
  return c.fullName || c.name || c.id;
}

export function branchLabel(b: Branch): string {
  return b.branchName || b.name || b.id;
}

export function memberLabel(m: Member): string {
  return m.fullName || m.name || m.memberCode || m.id;
}

/** Normalize HH:mm to HH:mm:ss for backend compatibility. */
export function normalizeTime(time: string): string {
  if (!time) return "";
  if (time.split(":").length === 3) return time;
  return `${time}:00`;
}

/** Convert a datetime-local value to ISO string. */
export function toIsoDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

/** Format an ISO date/time for display. */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(time?: string | null): string {
  if (!time) return "-";
  return time.slice(0, 5);
}
