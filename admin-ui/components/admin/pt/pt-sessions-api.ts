import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import type { PtSessionParticipant } from "./pt-types";

/**
 * Fetch the participant list for a single PT session.
 *
 * `GET /api/v1/pt-sessions/{id}/participants` returns
 * `[{ memberId, memberCode, fullName, isAttended, checkInTime }]`.
 * Non-array responses are normalized to `[]`; a 401 routes to login.
 */
export async function fetchParticipants(id: string): Promise<PtSessionParticipant[]> {
  const res = await authFetch(
    `${API_BASE_URL}/api/v1/pt-sessions/${id}/participants`,
    { cache: "no-store" }
  );
  if (redirectToLoginIfUnauthorized(res.status)) return [];
  if (!res.ok) throw new Error("Gagal memuat peserta PT session.");
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as PtSessionParticipant[]) : [];
}