"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/table-states";
import { useRole } from "@/contexts/role-context";
import { errorMessageOf } from "@/lib/api/http";
import { listLoyaltyAccounts, type LoyaltyBalance } from "@/lib/api/loyalty";
import type { PickedMember } from "./adjust-points-modal";
import { SearchBox } from "./search-box";

const PAGE_SIZE = 20;
const COLUMNS = 6;

type Props = {
  /** Bumped by the parent after an adjustment so balances re-read. */
  refreshKey: number;
  onOpenLedger: (member: PickedMember) => void;
  onAdjust: (member: PickedMember | null) => void;
};

/** Member point balances (`GET /api/v1/loyalty/accounts`). */
export function LoyaltyCustomersTab({ refreshKey, onOpenLedger, onAdjust }: Props) {
  const { can } = useRole();
  const canWrite = can("loyalty.write");

  const [rows, setRows] = useState<LoyaltyBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    try {
      const result = await listLoyaltyAccounts({ page, pageSize: PAGE_SIZE, search });
      setRows(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to load loyalty accounts"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const toMember = (r: LoyaltyBalance): PickedMember => ({
    id: r.memberId,
    name: r.memberName,
    code: r.memberCode,
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <SearchBox
          placeholder="Search member / code..."
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {canWrite ? (
          <button
            type="button"
            onClick={() => onAdjust(null)}
            className="bg-sweat text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-400 transition inline-flex items-center gap-2 self-start"
          >
            <i className="fas fa-plus-minus" aria-hidden />
            Adjust points
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Total earned</th>
                <th className="px-4 py-3 text-right">Total redeemed</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
                  icon="fa-users"
                  title="No loyalty accounts found"
                  description={search ? `Nothing matches "${search}".` : "Members appear here once they earn points."}
                />
              ) : (
                rows.map((r) => (
                  <tr key={r.memberId} className="hover:bg-fg/5 transition">
                    <td className="px-4 py-3 font-medium text-fg">{r.memberName || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-accent-ink">{r.memberCode || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-accent-ink">{r.balance}</td>
                    <td className="px-4 py-3 text-right text-fg">{r.totalEarned}</td>
                    <td className="px-4 py-3 text-right text-fg">{r.totalRedeemed}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenLedger(toMember(r))}
                          className="text-xs text-muted hover:text-fg border border-border px-2 py-1 rounded transition"
                        >
                          Ledger
                        </button>
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => onAdjust(toMember(r))}
                            className="text-xs text-fg border border-sweat/40 bg-sweat/10 hover:bg-sweat/20 px-2 py-1 rounded transition"
                          >
                            Adjust points
                          </button>
                        ) : null}
                      </div>
                    </td>
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
          label="members"
        />
      </div>
    </div>
  );
}
