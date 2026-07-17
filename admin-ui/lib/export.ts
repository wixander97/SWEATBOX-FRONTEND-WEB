/**
 * Build and download an `.xlsx` (OOXML) file from an array-of-arrays.
 *
 * Uses a dynamic import of SheetJS (`xlsx`) so the library is code-split out of
 * the main bundle and only loaded when an export actually runs.
 *
 * @param aoa - Array of rows; first row is treated as the header. All cell
 *   values are written as-is (string/number), matching prior CSV content.
 * @param filename - Download filename (should end in `.xlsx`).
 */
export async function downloadXlsx(
  aoa: (string | number)[][],
  filename: string
): Promise<void> {
  try {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    const sheetName = toSafeSheetName(filename);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(`[lib/export] downloadXlsx(${filename}) failed:`, err);
  }
}

/**
 * Derive a spreadsheet-safe sheet name from a filename.
 * - strips any extension
 * - removes characters disallowed by Excel sheet names: `[]:*?/\`
 * - truncates to the 31-char Excel limit
 */
export function toSafeSheetName(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  const sanitized = stem.replace(/[[\]:*?/\\]/g, "");
  return sanitized.slice(0, 31) || "Sheet1";
}