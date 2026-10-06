"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { InfoNote, inputClass } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/contexts/role-context";
import {
  QUALIFICATION_SHORT_LABELS,
  REFERRAL_STATUSES,
  cancelReferral,
  listReferrals,
  type Referral,
} from "@/lib/api/customer-benefits";
import { errorMessageOf } from "@/lib/api/http";
import { jakartaDate, jakartaDateTime } from "@/lib/jakarta-time";
import { SearchBox } from "./search-box";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<string, BadgeTone> = {
  Pending: "warning",
  Qualified: "info",
  Rewarded: "success",
  Cancelled: "neutral",
};

/** Every referral (`GET /api/v1/referrals`), with cancel for pending ones. */
export function ReferralsTab() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("loyalty.write");
  const columns = canWrite ? 9 : 8;

  const [rows, setRows] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [cancelling, setCancelling] = useState<Referral | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await listReferrals({
        page,
        pageSize: PAGE_SIZE,
        search,
        status: status || undefined,
      });
      setRows(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to load referrals"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCancel(r: Referral) {
    setCancelling(r);
    setCancelReason("");
    setCancelError(null);
  }

  async function confirmCancel() {
    if (!cancelling || cancelBusy) return;
    if (!cancelReason.trim()) {
      setCancelError("Please give a reason for cancelling.");
      return;
    }
    setCancelBusy(true);
    try {
      await cancelReferral(cancelling.id, cancelReason.trim());
      toast.success("Referral cancelled");
      setCancelling(null);
      setLoading(true);
      void load();
    } catch (err) {
      setCancelError(errorMessageOf(err, "Failed to cancel the referral"));
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <SearchBox
          placeholder="Search name / member code / referral code..."
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
            setLoading(true);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setLoading(true);
          }}
          aria-label="Filter by status"
          className="bg-sidebar border border-border text-fg text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sweat"
        >
          <option value="">All statuses</option>
          {REFERRAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <InfoNote>
          Rewards are granted automatically once. To correct points use Adjust points (recorded
          with reason and admin).
        </InfoNote>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">Referred customer</th>
                <th className="px-4 py-3">Referral code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Qualification</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Notes</th>
                {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <LoadingState colSpan={columns} />
              ) : error ? (
                <ErrorState
                  colSpan={columns}
                  message={error}
                  onRetry={() => {
                    setLoading(true);
                    void load();
                  }}
                />
              ) : rows.length === 0 ? (
                <EmptyState colSpan={columns} icon="fa-user-plus" title="No referrals found" />
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-fg/5 transition align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{jakartaDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-fg">{r.referrerName || "—"}</p>
                      <p className="font-mono text-[11px] text-accent-ink">{r.referrerCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-fg">{r.referredName || "—"}</p>
                      <p className="font-mono text-[11px] text-accent-ink">{r.referredCode}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg">{r.referralCode || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-fg text-xs">
                        {QUALIFICATION_SHORT_LABELS[r.qualificationEvent] ?? r.qualificationEvent ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted">
                        {r.qualifiedAt ? `Qualified ${jakartaDate(r.qualifiedAt)}` : "Not qualified yet"}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <p>
                        Referrer <span className="font-mono font-bold text-success">+{r.referrerPoints}</span>
                      </p>
                      <p>
                        New customer{" "}
                        <span className="font-mono font-bold text-success">+{r.referredPoints}</span>
                      </p>
                      {r.rewardedAt ? (
                        <p className="text-[11px] text-muted">Rewarded {jakartaDate(r.rewardedAt)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <span className="line-clamp-2" title={r.notes}>
                        {r.notes || "—"}
                      </span>
                    </td>
                    {canWrite ? (
                      <td className="px-4 py-3 text-right">
                        {r.status === "Pending" ? (
                          <button
                            type="button"
                            onClick={() => openCancel(r)}
                            className="text-xs text-danger border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                          >
                            <i className="fas fa-ban" aria-hidden />
                            Cancel
                          </button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    ) : null}
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
          label="referrals"
        />
      </div>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel referral"
        destructive
        busy={cancelBusy}
        confirmLabel="Cancel referral"
        onCancel={() => {
          if (!cancelBusy) setCancelling(null);
        }}
        onConfirm={() => void confirmCancel()}
        message={
          cancelling ? (
            <div className="space-y-3">
              <p>
                Cancel the pending referral of{" "}
                <span className="text-fg font-medium">{cancelling.referredName}</span> by{" "}
                <span className="text-fg font-medium">{cancelling.referrerName}</span> (
                <span className="font-mono">{cancelling.referralCode}</span>)? No rewards will be
                granted for it.
              </p>
              <div>
                <label htmlFor="referral-cancel-reason" className="block text-muted text-sm mb-1">
                  Reason<span className="text-accent-ink ml-1">*</span>
                </label>
                <textarea
                  id="referral-cancel-reason"
                  rows={3}
                  maxLength={500}
                  className={inputClass(Boolean(cancelError) && !cancelReason.trim())}
                  value={cancelReason}
                  onChange={(e) => {
                    setCancelReason(e.target.value);
                    if (e.target.value.trim()) setCancelError(null);
                  }}
                  placeholder="e.g. Same person registered twice"
                />
                {cancelError ? <p className="text-xs text-danger mt-1">{cancelError}</p> : null}
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}
