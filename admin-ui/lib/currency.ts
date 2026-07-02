/**
 * Currency input helpers (id-ID convention, no prefix).
 * - Thousands separator: "."
 * - Decimal separator: ","
 * - Max 2 decimals
 *
 * These format/parse a numeric value for a currency <input>. The "Rp" prefix
 * is rendered as a separate UI element (e.g. a <span>), not part of these helpers.
 */

/** Format a number as an id-ID currency string: 1500000.5 -> "1.500.000,5". */
export function formatCurrencyInput(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "0";
  const negative = n < 0;
  const abs = Math.abs(n);
  const rounded = Math.round(abs * 100) / 100;
  const [intPart, decPart] = rounded.toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = decPart && decPart !== "00" ? `,${decPart.replace(/0+$/, "")}` : "";
  const result = `${withThousands}${decimals}`;
  return negative ? `-${result}` : result;
}

/**
 * Parse an id-ID currency string back to a number.
 * Accepts "." as thousands separator and "," as decimal separator.
 * Non-numeric characters (except separators) are ignored. Empty -> 0.
 */
export function parseCurrencyInput(s: string): number {
  if (!s) return 0;
  // Keep digits, ".", and ","
  const cleaned = s.replace(/[^0-9.,]/g, "");
  if (!cleaned) return 0;
  // If there is a "," treat the part after the last "," as decimals.
  const hasDecimal = cleaned.includes(",");
  if (!hasDecimal) {
    // Only thousands separators (dots) -> remove them.
    const digits = cleaned.replace(/\./g, "");
    const n = parseInt(digits, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  const lastComma = cleaned.lastIndexOf(",");
  const intPart = cleaned.slice(0, lastComma).replace(/\./g, "");
  let decPart = cleaned.slice(lastComma + 1).replace(/\./g, "");
  if (decPart.length > 2) decPart = decPart.slice(0, 2);
  const intN = intPart ? parseInt(intPart, 10) : 0;
  const decN = decPart ? parseInt(decPart, 10) : 0;
  const decValue = decPart ? decN / Math.pow(10, decPart.length) : 0;
  const n = intN + decValue;
  return Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
}
