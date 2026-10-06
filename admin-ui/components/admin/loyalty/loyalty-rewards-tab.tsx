"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/contexts/role-context";
import { listBranches, type Branch } from "@/lib/api/branches";
import { errorMessageOf } from "@/lib/api/http";
import { deleteLoyaltyReward, listLoyaltyRewards, type LoyaltyReward } from "@/lib/api/loyalty";
import { formatCurrency } from "@/lib/format";
import { jakartaDate } from "@/lib/jakarta-time";
import { RewardFormModal } from "./reward-form-modal";

const COLUMNS = 9;

function rewardStatus(r: LoyaltyReward): { label: string; tone: "success" | "neutral" | "warning" } {
  if (!r.isActive) return { label: "Inactive", tone: "neutral" };
  if (r.isAvailable) return { label: "Available", tone: "success" };
  if (r.remainingQuantity !== null && r.remainingQuantity <= 0) {
    return { label: "Out of stock", tone: "warning" };
  }
  return { label: "Not in dates", tone: "warning" };
}

/** Reward catalogue (`/api/v1/loyalty/rewards`). */
export function LoyaltyRewardsTab() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("loyalty.write");

  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ reward: LoyaltyReward | null } | null>(null);
  const [deleting, setDeleting] = useState<LoyaltyReward | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRewards(await listLoyaltyRewards());
      setError(null);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to load rewards"));
      setRewards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteLoyaltyReward(deleting.id);
      toast.success("Reward deleted", deleting.name);
      setDeleting(null);
      void load();
    } catch (err) {
      toast.error("Could not delete reward", errorMessageOf(err, "Failed to delete reward"));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-muted">
          Members redeem rewards in the app; each redemption issues a voucher code.
        </p>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setForm({ reward: null })}
            className="bg-sweat text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-400 transition inline-flex items-center gap-2 shrink-0"
          >
            <i className="fas fa-plus" aria-hidden />
            New Reward
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-4 py-3">Reward</th>
                <th className="px-4 py-3 text-right">Voucher</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3 text-center">Validity</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Status</th>
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
              ) : rewards.length === 0 ? (
                <EmptyState
                  colSpan={COLUMNS}
                  icon="fa-gift"
                  title="No rewards yet"
                  description={canWrite ? "Create a reward members can exchange points for." : undefined}
                />
              ) : (
                rewards.map((r) => {
                  const status = rewardStatus(r);
                  return (
                    <tr key={r.id} className="hover:bg-fg/5 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-fg">{r.name}</p>
                        {r.description ? (
                          <p className="text-[11px] text-muted line-clamp-1">{r.description}</p>
                        ) : null}
                        {r.minimumTransaction > 0 ? (
                          <p className="text-[11px] text-muted">
                            Min. transaction {formatCurrency(r.minimumTransaction)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-fg">
                        {formatCurrency(r.voucherAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-accent-ink">{r.requiredPoints}</p>
                        {r.requiredPoints > 0 ? (
                          <p className="text-[11px] text-muted whitespace-nowrap">
                            1 pt = {formatCurrency(r.voucherAmount / r.requiredPoints)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center text-fg whitespace-nowrap">
                        {r.totalQuantity == null
                          ? `Unlimited · ${r.redeemedCount} used`
                          : `${r.remainingQuantity ?? 0}/${r.totalQuantity}`}
                      </td>
                      <td className="px-4 py-3 text-fg">{r.branchName || "All branches"}</td>
                      <td className="px-4 py-3 text-center text-fg whitespace-nowrap">
                        {r.voucherValidityDays ? `${r.voucherValidityDays} days` : "No expiry"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.startDate || r.endDate
                          ? `${r.startDate ? jakartaDate(r.startDate) : "Now"} → ${
                              r.endDate ? jakartaDate(r.endDate) : "No end"
                            }`
                          : "Always"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canWrite ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => setForm({ reward: r })}
                              className="bg-sweat text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-400 transition inline-flex items-center gap-1.5"
                            >
                              <i className="fas fa-edit" aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(r)}
                              aria-label={`Delete ${r.name}`}
                              className="border border-border text-danger px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/10 transition"
                            >
                              <i className="fas fa-trash" aria-hidden />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form ? (
        <RewardFormModal
          key={form.reward?.id ?? "new"}
          reward={form.reward}
          branches={branches}
          onClose={() => setForm(null)}
          onSaved={(saved, created) => {
            toast.success(created ? "Reward created" : "Reward saved", saved.name);
            void load();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete reward"
        message={
          <>
            Delete <strong>{deleting?.name}</strong>? Members will no longer see it. Vouchers
            already issued for it stay valid.
          </>
        }
        confirmLabel="Delete"
        destructive
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
