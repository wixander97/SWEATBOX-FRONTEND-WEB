/**
 * POS order reference.
 *
 * The backend keeps one `Payment` row per purchase and has two separate
 * endpoints for them (`POST /api/v1/payments` for a plan, `POST
 * /api/v1/payments/pt-package` for a PT package), so a customer who buys a
 * membership *and* a PT package in one visit always ends up with two invoices.
 * That is a backend model decision and this app does not change it.
 *
 * What it does instead: every checkout stamps the same short reference onto the
 * `Notes` of every payment it creates. Nothing else about the records changes —
 * no new field, no new endpoint — but the front desk and the Payments screen can
 * then tell "two invoices from one transaction" apart from "two separate sales",
 * print one combined slip, and group the history accordingly.
 *
 * Format: `TRX-YYYYMMDD-XXXX`, the suffix random so two tills on the same day
 * cannot collide.
 */

const PREFIX = "TRX";
/** Ambiguous characters (0/O, 1/I) left out — staff read these off paper. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SUFFIX_LENGTH = 4;

const ORDER_REF_PATTERN = new RegExp(
  `\\b${PREFIX}-\\d{8}-[${ALPHABET}]{${SUFFIX_LENGTH}}\\b`
);

function randomSuffix(): string {
  const values = new Uint32Array(SUFFIX_LENGTH);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < SUFFIX_LENGTH; i++) {
      values[i] = Math.floor(Math.random() * ALPHABET.length);
    }
  }
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join("");
}

function todayStamp(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}${m}${d}`;
}

/** A fresh reference for one checkout. */
export function newOrderRef(date = new Date()): string {
  return `${PREFIX}-${todayStamp(date)}-${randomSuffix()}`;
}

/**
 * Put the reference at the front of a payment note.
 *
 * First position on purpose: the Payments list truncates notes, and the
 * reference is the part that has to survive the truncation.
 */
export function stampOrderRef(ref: string, note: string): string {
  const body = note.trim();
  if (!ref) return body;
  if (parseOrderRef(body) === ref) return body;
  return body ? `${ref} · ${body}` : ref;
}

/** The reference stamped on a note, or `null` for a payment taken elsewhere. */
export function parseOrderRef(notes: string | null | undefined): string | null {
  if (!notes) return null;
  return ORDER_REF_PATTERN.exec(notes)?.[0] ?? null;
}

/** The note without its reference, for display next to an explicit ref column. */
export function noteWithoutOrderRef(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes.replace(ORDER_REF_PATTERN, "").replace(/^\s*·\s*/, "").trim();
}
