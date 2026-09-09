import { apiGet, apiPost, toList, type PagedResponse, type RequestOptions } from "./http";
import type { ApiMember } from "@/components/admin/members/members.types";

/**
 * Members service — reuses the existing `ApiMember` model. The POS has no
 * customer model of its own: a POS customer *is* a Sweatbox member.
 */

export type { ApiMember };

/**
 * `POST /api/v1/auth/register-member` body (`RegisterRequestMember`).
 *
 * This is the endpoint that creates a *new customer*: it provisions the User
 * account with the Member role **and** the Member record in one call, and
 * rejects an email that already exists. (`POST /api/v1/members` is a different
 * thing — it completes the profile of whoever is signed in — so the POS must
 * not use it.)
 */
export type QuickRegisterMemberRequest = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  /**
   * Profile details the backend also accepts on registration. All optional:
   * the front desk can register with name, phone and email alone and complete
   * the rest later from the member edit form.
   */
  gender?: string;
  /** ISO 8601 date-time, as produced by `dateToIso`. */
  dateOfBirth?: string | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  injuryAllergies?: string;
  /** "How did you hear about us?" — see `MEMBERSHIP_SOURCE_OPTIONS`. */
  membershipSource?: string;
};

/** `GET /api/v1/members/search` — matches name, member code, phone and email. */
export async function searchMembers(
  keyword: string,
  options?: RequestOptions
): Promise<ApiMember[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];
  const payload = await apiGet<ApiMember[] | PagedResponse<ApiMember>>(
    `/api/v1/members/search?keyword=${encodeURIComponent(trimmed)}&page=1&pageSize=20`,
    { errorMessage: "Failed to search members", ...options }
  );
  return toList(payload);
}

export function getMember(id: string, options?: RequestOptions): Promise<ApiMember> {
  return apiGet<ApiMember>(`/api/v1/members/${encodeURIComponent(id)}`, {
    errorMessage: "Failed to load member details",
    ...options,
  });
}

/**
 * Register a new customer, then return the created member record.
 *
 * The endpoint answers with a message rather than the member, so the new record
 * is read back through the existing search. A duplicate email is rejected
 * backend-side with "Failed to register member".
 */
export async function registerMember(
  body: QuickRegisterMemberRequest,
  options?: RequestOptions
): Promise<ApiMember | null> {
  await apiPost<{ message?: string }>("/api/v1/auth/register-member", body, {
    errorMessage: "Failed to register member",
    ...options,
  });
  const results = await searchMembers(body.email);
  return (
    results.find(
      (m) => (m.email ?? "").trim().toLowerCase() === body.email.trim().toLowerCase()
    ) ?? null
  );
}

/**
 * A password is mandatory backend-side (min 8 chars) but is not something a
 * front-desk queue should stop for, so one is generated and the customer
 * resets it later.
 */
export function generateMemberPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

/** Client-side pre-check so staff see an existing customer before creating one. */
export async function findDuplicateMember(
  phoneNumber: string,
  email: string
): Promise<ApiMember | null> {
  const candidates = new Set(
    [phoneNumber.trim(), email.trim()].filter((v) => v.length >= 3)
  );
  for (const candidate of candidates) {
    try {
      const results = await searchMembers(candidate);
      const match = results.find(
        (m) =>
          normalizePhone(m.phoneNumber) === normalizePhone(phoneNumber) ||
          (!!email.trim() &&
            (m.email ?? "").trim().toLowerCase() === email.trim().toLowerCase())
      );
      if (match) return match;
    } catch {
      // Search is a convenience here; the backend still validates on create.
    }
  }
  return null;
}

/** Strip formatting and the +62/62/0 prefixes so "0812…" matches "+62812…". */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function memberDisplayName(m: ApiMember | null | undefined): string {
  if (!m) return "-";
  return m.fullName || m.memberCode || m.id;
}
