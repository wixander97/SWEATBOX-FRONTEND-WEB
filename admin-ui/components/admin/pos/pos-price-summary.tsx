"use client";

import { formatRupiah } from "@/lib/pos/cart";
import { priceSummaryRows, type CartSummary } from "@/lib/pos/pricing";

type Props = {
  summary: CartSummary;
  /** Quotes are still loading. */
  loading?: boolean;
};

/** Subtotal, discount and total, priced by the backend. */
export function PosPriceSummary({ summary, loading = false }: Props) {
  const rows = priceSummaryRows(summary);

  return (
    <div className="space-y-2" aria-busy={loading}>
      {rows.map((row) =>
        row.key === "total" ? (
          <div
            key={row.key}
            className="flex justify-between items-baseline pt-2 border-t border-border"
          >
            <span className="text-sm font-bold uppercase text-fg-soft">{row.label}</span>
            <span className="text-xl font-bold text-accent-ink font-display">
              {loading ? "…" : formatRupiah(row.amount)}
            </span>
          </div>
        ) : (
          <div
            key={row.key}
            className={`flex justify-between ${row.detail ? "text-[11px] pl-3" : "text-sm"}`}
          >
            <span className="text-muted">{row.label}</span>
            <span
              className={
                row.negative ? "text-success font-semibold" : row.detail ? "text-muted" : "text-fg-soft"
              }
            >
              {loading && row.key !== "subtotal"
                ? "…"
                : `${row.negative ? "-" : ""}${formatRupiah(row.amount)}`}
            </span>
          </div>
        )
      )}
      {!loading && !summary.complete && summary.lines.length > 0 && (
        <p className="text-[11px] text-warning">
          Some prices could not be confirmed with the backend. The amount charged is the one the
          payment is created with.
        </p>
      )}
    </div>
  );
}
