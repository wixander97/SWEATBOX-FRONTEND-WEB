/**
 * Integer count input helpers (id-ID convention, no currency, no decimals).
 * - Thousands separator: "."
 * - No decimal separator
 *
 * These format/parse a non-negative integer for count <input>s
 * (e.g. session count, capacity, max participants). Mirrors the Price input
 * UX but integer-only and without a currency prefix.
 */

/** Format a non-negative integer as an id-ID grouped string: 1500000 -> "1.500.000". */
export function formatCountInput(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  const abs = Math.abs(Math.trunc(n));
  const digits = String(abs);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Parse an id-ID grouped integer string back to a number.
 * Keeps digits only (ignores "." thousands separators and any other chars).
 * Empty / no digits -> 0. Negatives clamped to 0.
 */
export function parseCountInput(s: string): number {
  if (!s) return 0;
  const digits = s.replace(/\D/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}