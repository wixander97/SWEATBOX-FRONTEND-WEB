"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MembershipPlanFormModal } from "@/components/admin/membership-plan-form-modal";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
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
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { downloadXlsx } from "@/lib/export";
import type { Branch } from "@/lib/branches";
import {
  MEMBERSHIP_TYPES,
  formatAccessDays,
  formatAccessWindow,
  membershipTypeLabel,
  unavailableReason,
  type MembershipPlan,
  type MembershipPlanRequest,
} from "@/lib/membership-plans";

/**
 * The plan catalogue.
 *
 * The availability column reads the backend's own `isOnSale`, so a plan whose
 * promo window closed shows as unavailable here for exactly the same reason POS
 * refuses to sell it — there is one answer, and it comes from the server.
 */

const COLUMNS = 8;

export function MembershipPlansView() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("membershipPlan.write");
  const canDelete = can("membershipPlan.delete");

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [deleting, setDeleting] = useState<MembershipPlan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<MembershipPlan[]>("/api/membership-plans", {
        query: { branchId: branchFilter },
      });
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(errorMessage(err));
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [branchFilter]);

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

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plans
      .filter((plan) => !typeFilter || plan.membershipType === typeFilter)
      .filter(
        (plan) =>
          !term ||
          plan.planName.toLowerCase().includes(term) ||
          (plan.description ?? "").toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const branch = (a.branchName ?? "").localeCompare(b.branchName ?? "");
        return branch !== 0 ? branch : a.planName.localeCompare(b.planName);
      });
  }, [plans, search, typeFilter]);

  /**
   * The catalogue as a spreadsheet.
   *
   * Exports the rows currently in view, so the branch, type and search filters
   * above decide what lands in the file. The access rules and the sales window
   * travel with each row: a plan's price means little without the window it is
   * sellable in.
   */
  async function exportXlsx() {
    const val = (v?: string | null) => v || "—";
    const yesNo = (v?: boolean | null) => (v ? "Yes" : "No");
    const num = (n?: number | null) =>
      n != null ? n.toLocaleString("id-ID") : "—";

    const header = [
      "Plan Name",
      "Description",
      "Branch",
      "Membership Type",
      "Price",
      "Member Price",
      "Credits",
      "Validity (Days)",
      "Active",
      "Unlimited Classes",
      "PT Included",
      "PT Sessions",
      "Popular",
      "Plan Category",
      "Registration Fee",
      "Allow Multi-Branch Access",
      "Class Access",
      "Open Gym Access",
      "Access Days",
      "Access Window",
      "Available For Sale",
      "On Sale Now",
      "Sales Start",
      "Sales End",
      "Member Discount (%)",
    ];
    const rows = visible.map((p) => [
      val(p.planName),
      val(p.description),
      val(p.branchName),
      membershipTypeLabel(p.membershipType),
      num(p.price),
      num(p.memberPrice),
      p.isUnlimitedClasses ? "Unlimited" : String(p.credits ?? 0),
      String(p.validityDays ?? 0),
      yesNo(p.isActive),
      yesNo(p.isUnlimitedClasses),
      yesNo(p.isPtIncluded),
      String(p.ptSessions ?? 0),
      yesNo(p.isPopular),
      val(p.planCategory),
      num(p.registrationFee),
      yesNo(p.allowMultiBranchAccess),
      yesNo(p.allowsClassAccess),
      yesNo(p.allowsOpenGymAccess),
      formatAccessDays(p.accessDaysOfWeek),
      formatAccessWindow(p),
      yesNo(p.isAvailableForSale),
      yesNo(p.isOnSale),
      p.salesStartDate ? formatDate(p.salesStartDate) : "—",
      p.salesEndDate ? formatDate(p.salesEndDate) : "—",
      String(p.memberDiscountPercent ?? 0),
    ]);

    await downloadXlsx([header, ...rows], "membership-plans.xlsx");
  }

  async function savePlan(values: MembershipPlanRequest) {
    if (editing) {
      await apiRequest(`/api/membership-plans/${editing.id}`, {
        method: "PUT",
        body: values,
      });
      toast.success("Membership plan updated.");
    } else {
      await apiRequest("/api/membership-plans", {
        method: "POST",
        body: values,
      });
      toast.success("Membership plan created.");
    }
    await load();
  }

  /** Active and available-for-sale are both flipped through update. */
  async function toggleFlag(
    plan: MembershipPlan,
    flag: "isActive" | "isAvailableForSale"
  ) {
    setBusyId(plan.id);
    try {
      await apiRequest(`/api/membership-plans/${plan.id}`, {
        method: "PUT",
        body: {
          branchId: plan.branchId,
          planName: plan.planName,
          description: plan.description ?? "",
          price: plan.price,
          credits: plan.credits,
          validityDays: plan.validityDays,
          isUnlimitedClasses: plan.isUnlimitedClasses,
          isPtIncluded: plan.isPtIncluded,
          ptSessions: plan.ptSessions,
          isPopular: plan.isPopular,
          planCategory: plan.planCategory ?? "",
          registrationFee: plan.registrationFee,
          allowMultiBranchAccess: plan.allowMultiBranchAccess,
          isActive: flag === "isActive" ? !plan.isActive : plan.isActive,
          membershipType: plan.membershipType ?? "",
          allowsClassAccess: plan.allowsClassAccess,
          allowsOpenGymAccess: plan.allowsOpenGymAccess,
          expiresAtEndOfDay: plan.expiresAtEndOfDay,
          accessDaysOfWeek: plan.accessDaysOfWeek ?? "",
          accessStartTime: plan.accessStartTime ?? null,
          accessEndTime: plan.accessEndTime ?? null,
          lastSessionStartTime: plan.lastSessionStartTime ?? null,
          isAvailableForSale:
            flag === "isAvailableForSale"
              ? !plan.isAvailableForSale
              : plan.isAvailableForSale,
          salesStartDate: plan.salesStartDate ?? null,
          salesEndDate: plan.salesEndDate ?? null,
          memberDiscountPercent: plan.memberDiscountPercent,
        },
      });
      toast.success("Membership plan updated.");
      await load();
    } catch (err) {
      toast.error("Could not update the plan", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function removePlan(plan: MembershipPlan) {
    setBusyId(plan.id);
    try {
      await apiRequest(`/api/membership-plans/${plan.id}`, {
        method: "DELETE",
      });
      toast.success("Membership plan deleted.");
      await load();
    } catch (err) {
      toast.error("Could not delete the plan", errorMessage(err));
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold font-display uppercase text-white">
                Membership Plans
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                Price, validity, access rules and the sales window. Everything
                configured here is enforced by the backend when a member books
                or buys.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => void exportXlsx()}
                disabled={loading || visible.length === 0}
                className="bg-sidebar border border-border text-fg px-4 py-2 rounded-lg text-sm hover:bg-fg/5 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="fas fa-file-export" aria-hidden />
                Export
              </button>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                  className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2"
                >
                  <i className="fas fa-plus" aria-hidden />
                  New Plan
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <i
                className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plans"
                aria-label="Search membership plans"
                className={`${FIELD_CLASS} !py-2 !pl-9 text-sm`}
              />
            </div>
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
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by membership type"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              <option value="">All membership types</option>
              {MEMBERSHIP_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm text-gray-400">
            <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
              <tr>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Credits / Validity</th>
                <th className="px-6 py-4">Access</th>
                <th className="px-6 py-4">Sales Period</th>
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
              ) : visible.length === 0 ? (
                <EmptyState
                  colSpan={COLUMNS}
                  icon="fa-id-card"
                  title="No plans found"
                  description="Adjust the filters, or create the first plan for this branch."
                />
              ) : (
                visible.map((plan) => {
                  const blocked = unavailableReason(plan);
                  const busy = busyId === plan.id;
                  return (
                    <tr key={plan.id} className="table-row transition">
                      <td className="px-6 py-4">
                        <span className="text-white font-medium block">
                          {plan.planName}
                        </span>
                        <span className="text-xs text-gray-500 line-clamp-1">
                          {plan.description || "No description"}
                        </span>
                        <span className="flex flex-wrap gap-1.5 mt-1.5">
                          <Badge tone={plan.isActive ? "success" : "neutral"}>
                            {plan.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {plan.isOnSale ? (
                            <Badge tone="accent" icon="fa-cart-shopping">
                              On sale
                            </Badge>
                          ) : (
                            <Badge tone="warning" icon="fa-ban">
                              {blocked}
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300 whitespace-nowrap">
                          {plan.branchName || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {membershipTypeLabel(plan.membershipType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-white font-bold block">
                          {formatCurrency(plan.price)}
                        </span>
                        {plan.memberPrice !== plan.price ? (
                          <span className="text-xs text-sweat">
                            Member {formatCurrency(plan.memberPrice)}
                          </span>
                        ) : null}
                        {plan.registrationFee > 0 ? (
                          <span className="block text-xs text-gray-500">
                            + {formatCurrency(plan.registrationFee)} joining
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        <span className="block text-white">
                          {plan.isUnlimitedClasses
                            ? "Unlimited classes"
                            : `${plan.credits} credit${plan.credits === 1 ? "" : "s"}`}
                        </span>
                        <span className="text-gray-500">
                          {plan.validityDays} day
                          {plan.validityDays === 1 ? "" : "s"}
                          {plan.expiresAtEndOfDay ? " • ends at midnight" : ""}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="block text-white">
                          {formatAccessDays(plan.accessDaysOfWeek)}
                        </span>
                        <span className="text-gray-500 block">
                          {formatAccessWindow(plan)}
                        </span>
                        {plan.lastSessionStartTime ? (
                          <span className="text-gray-500 block">
                            Last start{" "}
                            {formatTime(plan.lastSessionStartTime)}
                          </span>
                        ) : null}
                        <span className="text-gray-500 block mt-0.5">
                          {plan.allowsClassAccess ? "Classes" : "No classes"} •{" "}
                          {plan.allowsOpenGymAccess
                            ? "Open gym"
                            : "No open gym"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {plan.salesStartDate || plan.salesEndDate ? (
                          <>
                            <span className="block text-white">
                              {plan.salesStartDate
                                ? formatDate(plan.salesStartDate)
                                : "Open"}
                            </span>
                            <span className="text-gray-500">
                              →{" "}
                              {plan.salesEndDate
                                ? formatDate(plan.salesEndDate)
                                : "Open"}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500">No limit</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(plan);
                                  setFormOpen(true);
                                }}
                                className="text-gray-400 hover:text-white px-2 py-1"
                                aria-label={`Edit ${plan.planName}`}
                                title="Edit"
                              >
                                <i className="fas fa-edit" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleFlag(plan, "isAvailableForSale")
                                }
                                disabled={busy}
                                className="text-gray-400 hover:text-white px-2 py-1 disabled:opacity-40"
                                aria-label={`${plan.isAvailableForSale ? "Stop selling" : "Start selling"} ${plan.planName}`}
                                title={
                                  plan.isAvailableForSale
                                    ? "Stop selling"
                                    : "Make available for sale"
                                }
                              >
                                <i
                                  className={`fas ${
                                    busy
                                      ? "fa-circle-notch fa-spin"
                                      : plan.isAvailableForSale
                                        ? "fa-cart-shopping"
                                        : "fa-cart-plus"
                                  }`}
                                  aria-hidden
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleFlag(plan, "isActive")}
                                disabled={busy}
                                className="text-gray-400 hover:text-white px-2 py-1 disabled:opacity-40"
                                aria-label={`${plan.isActive ? "Deactivate" : "Activate"} ${plan.planName}`}
                                title={
                                  plan.isActive ? "Deactivate" : "Activate"
                                }
                              >
                                <i
                                  className={`fas ${
                                    plan.isActive
                                      ? "fa-toggle-on"
                                      : "fa-toggle-off"
                                  }`}
                                  aria-hidden
                                />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-600">
                              View only
                            </span>
                          )}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => setDeleting(plan)}
                              disabled={busy}
                              className="text-red-500 hover:text-red-400 px-2 py-1 disabled:opacity-40"
                              aria-label={`Delete ${plan.planName}`}
                              title="Delete"
                            >
                              <i className="fas fa-trash" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {!canWrite ? (
        <p className="text-xs text-gray-500">
          <i className="fas fa-lock mr-1.5" aria-hidden />
          Plans set price and access, so creating or changing one is reserved for
          a Super Admin. You can review them here.
        </p>
      ) : null}

      <MembershipPlanFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        plan={editing}
        branches={branches}
        onSubmit={savePlan}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this plan?"
        destructive
        confirmLabel="Delete"
        busy={busyId === deleting?.id}
        message={
          <>
            <strong className="text-white">{deleting?.planName}</strong> will be
            removed from the catalogue. If members currently hold it, deactivate
            it instead — that keeps their membership intact while taking it off
            sale.
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void removePlan(deleting);
        }}
      />
    </div>
  );
}
