"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CoachRateFormModal } from "@/components/admin/coach-rate-form-modal";
import { Badge } from "@/components/ui/badge";
import { FIELD_CLASS } from "@/components/ui/field";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PanelCard,
} from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { useRole } from "@/contexts/role-context";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Branch } from "@/lib/branches";
import {
  RATE_TYPES,
  type CoachRateTier,
  type CoachRateTierRequest,
  type RateType,
} from "@/lib/coach-rates";

/**
 * Coach pay tiers, split into the two ladders the backend keeps them in.
 *
 * They are shown as two tables rather than one with a type column: the numbers
 * are not comparable, and "which tier is the default assistant rate at Kedoya"
 * is a question the payroll run asks constantly.
 */

const COLUMNS = 7;

export function CoachRatesView() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("coachRate.write");

  const [tiers, setTiers] = useState<CoachRateTier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CoachRateTier | null>(null);
  const [formRateType, setFormRateType] = useState<RateType>(RATE_TYPES.coach);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<CoachRateTier[]>("/api/coach-rate-tiers", {
        query: {
          branchId: branchFilter,
          isActive: showInactive ? undefined : true,
        },
      });
      setTiers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(errorMessage(err));
      setTiers([]);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const data = await apiRequest<Branch[]>("/api/branches");
        setBranches(Array.isArray(data) ? data : []);
      } catch {
        setBranches([]);
      }
    }
    void loadBranches();
  }, []);

  const grouped = useMemo(() => {
    const byType = (type: RateType) =>
      tiers
        .filter((tier) => tier.rateType === type)
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

    return {
      coach: byType(RATE_TYPES.coach),
      assistant: byType(RATE_TYPES.assistant),
    };
  }, [tiers]);

  async function saveTier(values: CoachRateTierRequest) {
    if (editing) {
      await apiRequest(`/api/coach-rate-tiers/${editing.id}`, {
        method: "PUT",
        body: values,
      });
      toast.success("Rate tier updated.");
    } else {
      await apiRequest("/api/coach-rate-tiers", {
        method: "POST",
        body: values,
      });
      toast.success("Rate tier created.");
    }
    await load();
  }

  /** Toggling active reuses update, which is the only write the API offers. */
  async function toggleActive(tier: CoachRateTier) {
    setBusyId(tier.id);
    try {
      await apiRequest(`/api/coach-rate-tiers/${tier.id}`, {
        method: "PUT",
        body: {
          name: tier.name,
          rateType: tier.rateType,
          rate: tier.rate,
          branchId: tier.branchId ?? null,
          description: tier.description ?? "",
          isActive: !tier.isActive,
          isDefault: tier.isDefault,
          effectiveFrom: tier.effectiveFrom ?? null,
          effectiveTo: tier.effectiveTo ?? null,
        },
      });
      toast.success(
        tier.isActive ? "Rate tier deactivated." : "Rate tier activated."
      );
      await load();
    } catch (err) {
      toast.error("Could not update the rate tier", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function openCreate(rateType: RateType) {
    setEditing(null);
    setFormRateType(rateType);
    setFormOpen(true);
  }

  function renderTable(list: CoachRateTier[], rateType: RateType) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm text-muted">
          <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Rate</th>
              <th className="px-6 py-4">Branch</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Effective</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <LoadingState colSpan={COLUMNS} />
            ) : error ? (
              <ErrorState
                colSpan={COLUMNS}
                message={error}
                onRetry={() => void load()}
              />
            ) : list.length === 0 ? (
              <EmptyState
                colSpan={COLUMNS}
                icon="fa-money-bill-wave"
                title="No tiers configured"
                description={
                  rateType === RATE_TYPES.coach
                    ? "Add a coach rate so class schedules have a tier to point at."
                    : "Add an assistant rate so assistant seats can be paid."
                }
              />
            ) : (
              list.map((tier) => (
                <tr key={tier.id} className="table-row transition">
                  <td className="px-6 py-4">
                    <span className="text-fg font-medium">{tier.name}</span>
                    {tier.isDefault ? (
                      <span className="ml-2">
                        <Badge tone="accent" icon="fa-star">
                          Default
                        </Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-fg font-bold whitespace-nowrap">
                    {formatCurrency(tier.rate)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-fg/10 px-2 py-1 rounded text-xs text-fg-soft">
                      {tier.branchName || "All branches"}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <span className="line-clamp-2 text-xs">
                      {tier.description || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs whitespace-nowrap">
                    {tier.effectiveFrom || tier.effectiveTo ? (
                      <>
                        {formatDate(tier.effectiveFrom)}
                        {" → "}
                        {tier.effectiveTo ? formatDate(tier.effectiveTo) : "open"}
                      </>
                    ) : (
                      "Always"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      tone={tier.isActive ? "success" : "neutral"}
                      icon={tier.isActive ? "fa-circle-check" : "fa-circle-pause"}
                    >
                      {tier.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(tier);
                              setFormRateType(tier.rateType as RateType);
                              setFormOpen(true);
                            }}
                            className="text-muted hover:text-fg px-2 py-1"
                            aria-label={`Edit ${tier.name}`}
                            title="Edit"
                          >
                            <i className="fas fa-edit" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(tier)}
                            disabled={busyId === tier.id}
                            className="text-muted hover:text-fg px-2 py-1 disabled:opacity-40"
                            aria-label={`${tier.isActive ? "Deactivate" : "Activate"} ${tier.name}`}
                            title={tier.isActive ? "Deactivate" : "Activate"}
                          >
                            <i
                              className={`fas ${
                                busyId === tier.id
                                  ? "fa-circle-notch fa-spin"
                                  : tier.isActive
                                    ? "fa-toggle-on"
                                    : "fa-toggle-off"
                              }`}
                              aria-hidden
                            />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-muted">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelCard>
        <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold font-display uppercase text-fg">
              Coach Rates
            </h3>
            <p className="text-xs text-muted mt-1 max-w-xl">
              What each seat on a class is paid. A class schedule points at a
              tier rather than carrying a number, so a rate change does not mean
              editing every class.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              aria-label="Filter by branch"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branchName}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-muted whitespace-nowrap px-1">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 accent-[#ffd700]"
              />
              Show inactive
            </label>
          </div>
        </div>
      </PanelCard>

      {!canWrite ? (
        <p className="text-xs text-muted">
          <i className="fas fa-lock mr-1.5" aria-hidden />
          Rate tiers are pay configuration and can only be changed by a Super
          Admin. You can see them here.
        </p>
      ) : null}

      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-sweat/10 text-accent-ink flex items-center justify-center">
              <i className="fas fa-user-tie" aria-hidden />
            </span>
            <div>
              <h4 className="text-base font-bold text-fg uppercase font-display">
                Coach Rate
              </h4>
              <p className="text-xs text-muted">
                Paid to the primary coach leading the class.
              </p>
            </div>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={() => openCreate(RATE_TYPES.coach)}
              className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2"
            >
              <i className="fas fa-plus" aria-hidden />
              New Coach Rate
            </button>
          ) : null}
        </div>
        {renderTable(grouped.coach, RATE_TYPES.coach)}
      </PanelCard>

      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-blue-500/10 text-info flex items-center justify-center">
              <i className="fas fa-user-group" aria-hidden />
            </span>
            <div>
              <h4 className="text-base font-bold text-fg uppercase font-display">
                Assistant Coach Rate
              </h4>
              <p className="text-xs text-muted">
                Paid to each assistant coach assigned to the class.
              </p>
            </div>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={() => openCreate(RATE_TYPES.assistant)}
              className="bg-fg/5 hover:bg-fg/10 text-fg border border-border px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"
            >
              <i className="fas fa-plus" aria-hidden />
              New Assistant Rate
            </button>
          ) : null}
        </div>
        {renderTable(grouped.assistant, RATE_TYPES.assistant)}
      </PanelCard>

      <CoachRateFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        tier={editing}
        defaultRateType={formRateType}
        branches={branches}
        onSubmit={saveTier}
      />
    </div>
  );
}
