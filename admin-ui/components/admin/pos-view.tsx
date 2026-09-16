"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { QuickRegisterModal } from "@/components/admin/quick-register-modal";
import { Badge } from "@/components/ui/badge";
import { FIELD_CLASS, InfoNote } from "@/components/ui/field";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import { PanelCard } from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { apiRequest, errorMessage, openPdf } from "@/lib/api/client";
import { useRole } from "@/contexts/role-context";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ApiMember } from "@/lib/members";
import type { Branch } from "@/lib/branches";
import {
  isDiscountEligibleType,
  membershipTypeLabel,
  unavailableReason,
  type MembershipPlan,
} from "@/lib/membership-plans";
import {
  COUNTER_PAYMENT_METHODS,
  PAYMENT_CATEGORY,
  PAYMENT_METHOD,
  PAYMENT_PROVIDER,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  paymentStatusTone,
  type Payment,
} from "@/lib/payments";
import type { RegisteredMember } from "@/lib/member-registration";

/**
 * Point of sale.
 *
 * Two rules matter on this screen, and neither is implemented here:
 *
 * - **What a product costs.** The plan list carries the backend's own `price`
 *   and `memberPrice`, and the amount actually charged comes back on the
 *   payment the API creates. The browser never multiplies anything by 50%.
 * - **Whether a customer qualifies.** Eligibility is the customer holding an
 *   active membership at *either* club, which the API answers in the member
 *   record. It is never inferred from the branch the sale is happening at — a
 *   Kedoya member standing in PIK 2 is still a member.
 *
 * The prices shown before checkout are therefore a preview of backend values,
 * and the confirmation shows what the backend actually charged.
 */

export function PosView() {
  const toast = useToast();
  const { can } = useRole();
  const canSell = can("payment.write");
  const canRegister = can("member.register");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customer, setCustomer] = useState<ApiMember | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<number>(
    PAYMENT_METHOD.cash
  );
  const [notes, setNotes] = useState("");
  const [charging, setCharging] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadBranches() {
      try {
        const data = await apiRequest<Branch[]>("/api/branches");
        const list = Array.isArray(data) ? data : [];
        setBranches(list);
        const firstActive = list.find((b) => b.isActive) ?? list[0];
        if (firstActive) setBranchId(firstActive.id);
      } catch (err) {
        toast.error("Could not load branches", errorMessage(err));
      }
    }
    void loadBranches();
    // Runs once; the toast helper is stable for the life of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = useCallback(async () => {
    if (!branchId) return;
    setPlansLoading(true);
    setPlansError(null);
    try {
      const data = await apiRequest<MembershipPlan[]>("/api/membership-plans", {
        query: { branchId },
      });
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      setPlansError(errorMessage(err));
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  // Debounced customer search against the API's own member search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setDropdownOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiRequest<ApiMember[] | { items?: ApiMember[] }>(
          "/api/members/search",
          { query: { keyword: query.trim() } }
        );
        const list = Array.isArray(data) ? data : (data.items ?? []);
        setResults(list.slice(0, 8));
        setDropdownOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  /**
   * Whether the customer counts as an existing member.
   *
   * Read straight off the member record the API returned — `membershipStatus`
   * and `isExpired` are both computed server-side by the same rule the pricing
   * service uses. Deliberately not a comparison of branches: membership at
   * either club qualifies.
   */
  const customerIsMember = useMemo(() => {
    if (!customer) return false;
    return (
      (customer.membershipStatus ?? "").toLowerCase() === "active" &&
      customer.isActive !== false
    );
  }, [customer]);

  async function selectCustomer(member: ApiMember) {
    setDropdownOpen(false);
    setQuery("");
    setResults([]);
    // The search projection is lighter than the full record; re-read so the
    // membership status the price preview depends on is the current one.
    try {
      const full = await apiRequest<ApiMember>(`/api/members/${member.id}`);
      setCustomer(full);
    } catch {
      setCustomer(member);
    }
  }

  function onRegistered(member: RegisteredMember) {
    // Straight into the sale: "Register & Select" is one action at the desk.
    setCustomer({
      id: member.id,
      memberCode: member.memberCode,
      fullName: member.fullName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      membershipStatus: member.membershipStatus,
      homeClubBranchId: member.homeClubBranchId ?? null,
      isActive: true,
    });
  }

  /** The price the backend would quote this customer for this plan. */
  function priceFor(plan: MembershipPlan) {
    const discountable =
      isDiscountEligibleType(plan.membershipType) &&
      plan.memberPrice < plan.price;

    if (customerIsMember && discountable) {
      return { amount: plan.memberPrice, wasDiscounted: true };
    }
    return { amount: plan.price, wasDiscounted: false };
  }

  const sellable = useMemo(
    () => plans.filter((plan) => plan.isOnSale),
    [plans]
  );
  const notSellable = useMemo(
    () => plans.filter((plan) => !plan.isOnSale),
    [plans]
  );

  async function charge() {
    if (!selectedPlan || !customer || charging) return;

    setCharging(true);
    try {
      const payment = await apiRequest<Payment>("/api/payments", {
        method: "POST",
        body: {
          memberId: customer.id,
          membershipPlanId: selectedPlan.id,
          branchId,
          paymentCategory: PAYMENT_CATEGORY.membership,
          paymentMethod,
          // Settled at the counter rather than through the gateway.
          paymentProvider: PAYMENT_PROVIDER.manual,
          notes: notes.trim() || null,
        },
      });
      setReceipt(payment);
      setSelectedPlan(null);
      setNotes("");
      toast.success(
        "Sale recorded.",
        `Invoice ${payment.invoiceNo} • ${formatCurrency(payment.finalAmount)}`
      );
      // The purchase may have changed what the customer is entitled to.
      try {
        const refreshed = await apiRequest<ApiMember>(
          `/api/members/${customer.id}`
        );
        setCustomer(refreshed);
      } catch {
        /* the sale stands regardless */
      }
    } catch (err) {
      toast.error("The sale could not be completed", errorMessage(err));
    } finally {
      setCharging(false);
    }
  }

  async function viewInvoice(payment: Payment, mode: "view" | "download") {
    try {
      await openPdf(
        `/api/payments/${payment.id}/invoice/pdf`,
        mode,
        `${payment.invoiceNo || "Invoice"}.pdf`
      );
    } catch (err) {
      toast.error("Could not open the invoice", errorMessage(err));
    }
  }

  async function emailReceipt(payment: Payment) {
    try {
      await apiRequest(`/api/payments/${payment.id}/receipt/email`, {
        method: "POST",
        body: {},
      });
      toast.success("Receipt emailed to the member.");
    } catch (err) {
      toast.error("Could not send the receipt", errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <PanelCard>
        <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold font-display uppercase text-white">
              Point of Sale
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Select a customer, then a membership product. Prices come from the
              backend, including the member discount.
            </p>
          </div>
          <div className="lg:w-64">
            <label
              className="block text-gray-400 text-sm mb-1"
              htmlFor="pos-branch"
            >
              Branch
            </label>
            <select
              id="pos-branch"
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setSelectedPlan(null);
              }}
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branchName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </PanelCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <PanelCard className="xl:col-span-1">
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Customer
              </h4>
              {canRegister ? (
                <button
                  type="button"
                  onClick={() => setRegisterOpen(true)}
                  className="text-xs bg-sweat text-black font-bold px-3 py-2 rounded-lg hover:bg-yellow-400 transition"
                >
                  <i className="fas fa-user-plus mr-1.5" aria-hidden />
                  Quick Register
                </button>
              ) : null}
            </div>

            <div className="relative" ref={searchRef}>
              <i
                className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length && setDropdownOpen(true)}
                placeholder="Search by name, email or member code"
                aria-label="Search customers"
                className={`${FIELD_CLASS} !py-2 !pl-9 text-sm`}
              />
              {searching ? (
                <i
                  className="fas fa-circle-notch fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                  aria-hidden
                />
              ) : null}

              {dropdownOpen && results.length > 0 ? (
                <ul className="absolute z-20 mt-1 w-full bg-sidebar border border-border rounded-lg shadow-2xl max-h-72 overflow-y-auto">
                  {results.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => void selectCustomer(member)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition"
                      >
                        <span className="block text-sm text-white">
                          {member.fullName}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {member.memberCode || member.email || member.phoneNumber}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {dropdownOpen && !searching && results.length === 0 && query ? (
                <div className="absolute z-20 mt-1 w-full bg-sidebar border border-border rounded-lg p-4 text-xs text-gray-500">
                  No customer found. Use Quick Register to create one.
                </div>
              ) : null}
            </div>

            {customer ? (
              <div className="rounded-xl border border-border bg-sidebar/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">
                      {customer.fullName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {customer.memberCode} • {customer.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomer(null)}
                    className="text-gray-500 hover:text-white text-lg leading-none"
                    aria-label="Clear selected customer"
                  >
                    ×
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-gray-500">Membership</dt>
                    <dd className="text-white mt-0.5">
                      {customer.membershipPlanName || "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Status</dt>
                    <dd className="mt-0.5">
                      <Badge tone={customerIsMember ? "success" : "neutral"}>
                        {customer.membershipStatus || "None"}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Home club</dt>
                    <dd className="text-white mt-0.5">
                      {customer.homeClubBranchName || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Expires</dt>
                    <dd className="text-white mt-0.5">
                      {customer.expiryDate
                        ? formatDate(customer.expiryDate)
                        : "-"}
                    </dd>
                  </div>
                </dl>

                {customerIsMember ? (
                  <p className="text-xs text-sweat bg-sweat/5 border border-sweat/20 rounded-lg px-3 py-2">
                    <i className="fas fa-tag mr-1.5" aria-hidden />
                    Holds an active membership, so Drop In and 1 Day Pass are
                    priced at the member rate — at either branch.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    No active membership, so every product is at list price.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <i
                  className="fas fa-user text-gray-600 text-2xl mb-2 block"
                  aria-hidden
                />
                <p className="text-xs text-gray-500">
                  Search for a customer, or register a new one, before selecting
                  a product.
                </p>
              </div>
            )}
          </div>
        </PanelCard>

        <PanelCard className="xl:col-span-2">
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Membership Products
            </h4>
            <button
              type="button"
              onClick={() => void loadPlans()}
              disabled={plansLoading}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
            >
              <i
                className={`fas fa-rotate mr-1.5 ${plansLoading ? "fa-spin" : ""}`}
                aria-hidden
              />
              Refresh
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {plansLoading ? (
              <p className="text-sm text-gray-400 py-8 text-center">
                <i className="fas fa-circle-notch fa-spin text-sweat mr-2" aria-hidden />
                Loading products…
              </p>
            ) : plansError ? (
              <p className="text-sm text-red-400 py-8 text-center">
                {plansError}
              </p>
            ) : sellable.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No products are currently on sale at this branch.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sellable.map((plan) => {
                  const { amount, wasDiscounted } = priceFor(plan);
                  const active = selectedPlan?.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      disabled={!customer || !canSell}
                      className={`text-left rounded-xl border p-4 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        active
                          ? "border-sweat bg-sweat/10"
                          : "border-border bg-sidebar hover:border-gray-600"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-white">
                          {plan.planName}
                        </span>
                        {plan.isPopular ? (
                          <Badge tone="accent">Popular</Badge>
                        ) : null}
                      </span>

                      <span className="block text-xs text-gray-500 mt-0.5">
                        {membershipTypeLabel(plan.membershipType)} •{" "}
                        {plan.branchName}
                      </span>

                      <span className="block mt-3">
                        {wasDiscounted ? (
                          <>
                            <span className="text-xs text-gray-500 line-through mr-2">
                              {formatCurrency(plan.price)}
                            </span>
                            <span className="text-lg font-bold text-sweat">
                              {formatCurrency(amount)}
                            </span>
                            <span className="block text-[11px] text-sweat mt-0.5">
                              Member price
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-white">
                            {formatCurrency(amount)}
                          </span>
                        )}
                      </span>

                      <span className="block text-[11px] text-gray-500 mt-2">
                        {plan.isUnlimitedClasses
                          ? "Unlimited classes"
                          : `${plan.credits} credit${plan.credits === 1 ? "" : "s"}`}{" "}
                        • {plan.validityDays} day
                        {plan.validityDays === 1 ? "" : "s"}
                      </span>

                      {plan.salesEndDate ? (
                        <span className="block text-[11px] text-gray-500 mt-0.5">
                          On sale until {formatDate(plan.salesEndDate)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {notSellable.length > 0 ? (
              <details className="rounded-xl border border-border bg-sidebar/30 p-4">
                <summary className="text-xs text-gray-400 cursor-pointer">
                  {notSellable.length} plan
                  {notSellable.length === 1 ? "" : "s"} not available for
                  purchase
                </summary>
                <ul className="mt-3 space-y-2">
                  {notSellable.map((plan) => (
                    <li
                      key={plan.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-gray-400 truncate">
                        {plan.planName}{" "}
                        <span className="text-gray-600">
                          ({membershipTypeLabel(plan.membershipType)})
                        </span>
                      </span>
                      <Badge tone="warning">{unavailableReason(plan)}</Badge>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {!canSell ? (
              <InfoNote>
                Your role can look up customers but not record a sale.
              </InfoNote>
            ) : null}
          </div>
        </PanelCard>
      </div>

      <QuickRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        branches={branches}
        defaultBranchId={branchId}
        onRegistered={onRegistered}
      />

      <Modal
        open={Boolean(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
        busy={charging}
        title="Confirm Purchase"
        subtitle={customer ? customer.fullName : undefined}
      >
        {selectedPlan && customer ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-sidebar/40 p-4">
              <p className="text-white font-bold">{selectedPlan.planName}</p>
              <p className="text-xs text-gray-500">
                {membershipTypeLabel(selectedPlan.membershipType)} •{" "}
                {selectedPlan.branchName}
              </p>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-400">List price</dt>
                  <dd className="text-white">
                    {formatCurrency(selectedPlan.price)}
                  </dd>
                </div>
                {priceFor(selectedPlan).wasDiscounted ? (
                  <div className="flex justify-between">
                    <dt className="text-sweat">Member discount</dt>
                    <dd className="text-sweat">
                      −{" "}
                      {formatCurrency(
                        selectedPlan.price - selectedPlan.memberPrice
                      )}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <dt className="text-white font-bold">Expected total</dt>
                  <dd className="text-sweat font-bold text-lg">
                    {formatCurrency(priceFor(selectedPlan).amount)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <label
                className="block text-gray-400 text-sm mb-1"
                htmlFor="pos-method"
              >
                Payment Method
              </label>
              <select
                id="pos-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(Number(e.target.value))}
                className={FIELD_CLASS}
              >
                {COUNTER_PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-gray-400 text-sm mb-1"
                htmlFor="pos-notes"
              >
                Notes
              </label>
              <input
                id="pos-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional reference for the receipt"
                className={FIELD_CLASS}
              />
            </div>

            <InfoNote>
              The final amount is priced by the backend when the sale is
              recorded, including the member discount and the plan&apos;s sales
              window. The figure above is what it is expected to charge.
            </InfoNote>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <SecondaryButton
                onClick={() => setSelectedPlan(null)}
                disabled={charging}
              >
                Cancel
              </SecondaryButton>
              <SubmitButton
                type="button"
                submitting={charging}
                onClick={() => void charge()}
              >
                <i className="fas fa-cash-register" aria-hidden />
                Record Sale
              </SubmitButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Sale Recorded"
        subtitle={receipt ? `Invoice ${receipt.invoiceNo}` : undefined}
      >
        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge tone={paymentStatusTone(receipt.paymentStatus)}>
                {PAYMENT_STATUS_LABEL[receipt.paymentStatus] ?? "Unknown"}
              </Badge>
              <span className="text-xs text-gray-500">
                {PAYMENT_METHOD_LABEL[receipt.paymentMethod] ?? "-"}
              </span>
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">Amount</dt>
                <dd className="text-white">{formatCurrency(receipt.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Discount</dt>
                <dd className="text-white">
                  {formatCurrency(receipt.discount)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <dt className="text-white font-bold">Charged</dt>
                <dd className="text-sweat font-bold text-lg">
                  {formatCurrency(receipt.finalAmount)}
                </dd>
              </div>
            </dl>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <SecondaryButton
                onClick={() => void viewInvoice(receipt, "view")}
              >
                <i className="fas fa-file-pdf mr-2" aria-hidden />
                View Invoice
              </SecondaryButton>
              <SecondaryButton
                onClick={() => void viewInvoice(receipt, "download")}
              >
                <i className="fas fa-download mr-2" aria-hidden />
                Download
              </SecondaryButton>
              <SecondaryButton onClick={() => void emailReceipt(receipt)}>
                <i className="fas fa-envelope mr-2" aria-hidden />
                Email Receipt
              </SecondaryButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
