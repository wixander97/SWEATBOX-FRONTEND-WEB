"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/table-states";
import { errorMessageOf } from "@/lib/api/http";
import {
  PAYMENT_CATEGORY_OPTIONS,
  QUALIFICATION_SHORT_LABELS,
  listSettingsHistory,
  type SettingChangeLog,
  type SettingsArea,
} from "@/lib/api/customer-benefits";
import { formatCurrency } from "@/lib/format";
import { jakartaDate, jakartaDateTime } from "@/lib/jakarta-time";

const PAGE_SIZE = 10;
const COLUMNS = 5;

type ValueKind =
  | "bool"
  | "money"
  | "moneyOrNone"
  | "number"
  | "percentOrMoney"
  | "date"
  | "endDate"
  | "branches"
  | "categories"
  | "qualification"
  | "text";

/** Friendly labels and value formats for the audited setting keys. */
const KEYS: Record<string, { label: string; kind: ValueKind }> = {
  FIRST_TXN_DISCOUNT_ENABLED: { label: "Status", kind: "bool" },
  FIRST_TXN_DISCOUNT_TYPE: { label: "Discount type", kind: "text" },
  FIRST_TXN_DISCOUNT_AMOUNT: { label: "Discount amount", kind: "percentOrMoney" },
  FIRST_TXN_DISCOUNT_MIN_TRANSACTION: { label: "Minimum transaction", kind: "money" },
  FIRST_TXN_DISCOUNT_MAX_DISCOUNT: { label: "Maximum discount", kind: "moneyOrNone" },
  FIRST_TXN_DISCOUNT_START_DATE: { label: "Effective from", kind: "date" },
  FIRST_TXN_DISCOUNT_END_DATE: { label: "Effective until", kind: "endDate" },
  FIRST_TXN_DISCOUNT_BRANCHES: { label: "Applicable branches", kind: "branches" },
  FIRST_TXN_DISCOUNT_CATEGORIES: { label: "Applicable categories", kind: "categories" },

  REFERRAL_ENABLED: { label: "Status", kind: "bool" },
  REFERRAL_REFEREE_POINTS: { label: "New customer reward (points)", kind: "number" },
  REFERRAL_REFERRER_POINTS: { label: "Referrer reward (points)", kind: "number" },
  REFERRAL_QUALIFICATION: { label: "Qualification event", kind: "qualification" },
  REFERRAL_CODE_PREFIX: { label: "Code prefix", kind: "text" },
  REFERRAL_CODE_LENGTH: { label: "Code length", kind: "number" },
  REFERRAL_START_DATE: { label: "Campaign start", kind: "date" },
  REFERRAL_END_DATE: { label: "Campaign end", kind: "endDate" },

  LOYALTY_ENABLED: { label: "Programme enabled", kind: "bool" },
  LOYALTY_EARN_AMOUNT_PER_POINT: { label: "Amount per earning unit", kind: "money" },
  LOYALTY_EARN_POINTS: { label: "Points per earning unit", kind: "number" },
  LOYALTY_REVERSE_ON_REFUND: { label: "Reverse points on refund", kind: "bool" },
};

function formatValue(
  kind: ValueKind,
  raw: string | null | undefined,
  branchNames: Record<string, string>,
  isFirstChange: boolean
): string {
  const value = (raw ?? "").trim();
  if (!value) {
    if (isFirstChange && raw == null) return "(default)";
    switch (kind) {
      case "moneyOrNone":
        return "None";
      case "date":
        return "Immediately";
      case "endDate":
        return "No end date";
      case "branches":
        return "All branches";
      case "categories":
        return "All categories";
      default:
        return "—";
    }
  }
  switch (kind) {
    case "bool":
      return value.toLowerCase() === "true" ? "On" : value.toLowerCase() === "false" ? "Off" : value;
    case "money":
    case "moneyOrNone": {
      const n = Number(value);
      return Number.isFinite(n) ? formatCurrency(n) : value;
    }
    case "percentOrMoney": {
      // Rupiah for Fixed, percent (≤ 100) for Percent; no real rupiah
      // discount is ≤ Rp100, so a small number is a percentage.
      const n = Number(value);
      if (!Number.isFinite(n)) return value;
      return n <= 100 ? `${n}%` : formatCurrency(n);
    }
    case "date":
    case "endDate": {
      const shown = jakartaDate(value);
      return shown === "-" ? value : shown;
    }
    case "branches":
      return value
        .split(",")
        .map((id) => branchNames[id.trim().toLowerCase()] ?? id.trim().slice(0, 8))
        .join(", ");
    case "categories":
      return value
        .split(",")
        .map((c) => PAYMENT_CATEGORY_OPTIONS.find((o) => String(o.value) === c.trim())?.label ?? c)
        .join(", ");
    case "qualification":
      return QUALIFICATION_SHORT_LABELS[value] ?? value;
    default:
      return value;
  }
}

/**
 * The audited change log for one settings area
 * (`GET /api/v1/customer-benefits/settings-history?area=`).
 */
export function SettingsHistory({
  area,
  refreshKey,
  branchNames = {},
}: {
  area: SettingsArea;
  refreshKey: number;
  /** Branch id (lower-case) -> name, for the branch list setting. */
  branchNames?: Record<string, string>;
}) {
  const [rows, setRows] = useState<SettingChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    try {
      const result = await listSettingsHistory({ area, page, pageSize: PAGE_SIZE });
      setRows(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to load the change history"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [area, page]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="mt-8">
      <h3 className="font-display uppercase font-bold text-fg mb-3">
        <i className="fas fa-clock-rotate-left text-accent-ink mr-2" aria-hidden />
        Change history
      </h3>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Setting</th>
                <th className="px-4 py-3">Old → New</th>
                <th className="px-4 py-3">Changed by</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <LoadingState colSpan={COLUMNS} />
              ) : error ? (
                <ErrorState
                  colSpan={COLUMNS}
                  message={error}
                  onRetry={() => {
                    setLoading(true);
                    void load();
                  }}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  colSpan={COLUMNS}
                  icon="fa-clock-rotate-left"
                  title="No changes recorded yet"
                />
              ) : (
                rows.map((r) => {
                  const meta = KEYS[r.settingKey] ?? { label: r.settingKey, kind: "text" as const };
                  return (
                    <tr key={r.id} className="hover:bg-fg/5 transition align-top">
                      <td className="px-4 py-3 whitespace-nowrap">{jakartaDateTime(r.createdAt)}</td>
                      <td className="px-4 py-3 text-fg">{meta.label}</td>
                      <td className="px-4 py-3">
                        <span className="text-muted line-through decoration-muted/50">
                          {formatValue(meta.kind, r.oldValue, branchNames, true)}
                        </span>
                        <i className="fas fa-arrow-right text-[10px] mx-2 text-muted" aria-hidden />
                        <span className="text-fg font-medium">
                          {formatValue(meta.kind, r.newValue, branchNames, false)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.changedByName || "System"}</td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <span className="line-clamp-2" title={r.reason}>
                          {r.reason || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          loading={loading}
          onChange={(next) => {
            setLoading(true);
            setPage(next);
          }}
          label="changes"
        />
      </div>
    </section>
  );
}
