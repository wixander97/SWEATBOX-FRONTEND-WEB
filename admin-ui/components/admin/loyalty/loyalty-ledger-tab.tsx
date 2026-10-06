"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/table-states";
import { errorMessageOf } from "@/lib/api/http";
import {
  LOYALTY_ENTRY_TYPES,
  listLoyaltyLedger,
  type LoyaltyLedgerEntry,
} from "@/lib/api/loyalty";
import { jakartaDateTime } from "@/lib/jakarta-time";
import type { PickedMember } from "./adjust-points-modal";
import { SearchBox } from "./search-box";

const PAGE_SIZE = 20;
const COLUMNS = 8;

const TYPE_TONE: Record<string, BadgeTone> = {
  Earn: "success",
  Redeem: "accent",
  Adjust: "info",
  Reversal: "warning",
  Expire: "neutral",
  ReferralReward: "accent",
  ReferralSignupReward: "accent",
};

type Props = {
  member: PickedMember | null;
  onClearMember: () => void;
  refreshKey: number;
};

/** Every points movement (`GET /api/v1/loyalty/ledger`). */
export function LoyaltyLedgerTab({ member, onClearMember, refreshKey }: Props) {
  const [rows, setRows] = useState<LoyaltyLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const memberId = member?.id ?? "";

  const load = useCallback(async () => {
    try {
      const result = await listLoyaltyLedger({
        page,
        pageSize: PAGE_SIZE,
        memberId: memberId || undefined,
        type: type || undefined,
        search,
      });
      setRows(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to load the points ledger"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, memberId, type, search]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <SearchBox
          placeholder="Search member / reference..."
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by entry type"
          className="bg-sidebar border border-border text-fg text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sweat"
        >
          <option value="">All types</option>
          {LOYALTY_ENTRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {member ? (
          <span className="inline-flex items-center gap-2 bg-sweat/10 border border-sweat/30 text-fg text-xs rounded-full pl-3 pr-1 py-1 self-start lg:self-auto">
            <i className="fas fa-user text-accent-ink" aria-hidden />
            {member.name || member.code}
            {member.code ? <span className="font-mono text-accent-ink">{member.code}</span> : null}
            <button
              type="button"
              onClick={() => {
                onClearMember();
                setPage(1);
              }}
              aria-label="Show all members"
              className="w-5 h-5 rounded-full hover:bg-fg/10 text-muted hover:text-fg"
            >
              <i className="fas fa-times text-[10px]" aria-hidden />
            </button>
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Balance after</th>
                <th className="px-4 py-3">By</th>
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
                <EmptyState colSpan={COLUMNS} icon="fa-list" title="No ledger entries found" />
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-fg/5 transition">
                    <td className="px-4 py-3 whitespace-nowrap">{jakartaDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-fg">{r.memberName || "—"}</p>
                      <p className="font-mono text-[11px] text-accent-ink">{r.memberCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={TYPE_TONE[r.entryType] ?? "neutral"}>{r.entryType}</Badge>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold font-mono ${
                        r.points > 0 ? "text-success" : r.points < 0 ? "text-danger" : "text-fg"
                      }`}
                    >
                      {r.points > 0 ? `+${r.points}` : r.points < 0 ? `−${Math.abs(r.points)}` : "0"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg">{r.reference || "—"}</td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <span className="line-clamp-2" title={r.description}>
                        {r.description || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-fg">{r.balanceAfter}</td>
                    <td className="px-4 py-3">{r.createdByName || "System"}</td>
                  </tr>
                ))
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
          label="entries"
        />
      </div>
    </div>
  );
}
