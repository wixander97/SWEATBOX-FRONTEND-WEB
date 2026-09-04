"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import {
  PaymentCategory,
  PaymentMethod,
  PaymentProvider,
  asteriPayRedirectUrl,
  confirmEdcPayment,
  createDropInPayment,
  createMembershipPayment,
  getPayment,
  isAsteriPayReady,
  isPaid,
  pollPaymentUntilSettled,
  purchasePtPackage,
  type Payment,
} from "@/lib/api/payments";
import { PaymentStatus, paymentStatusMeta } from "@/components/admin/payments/payment-status";
import { listMemberDropInPasses } from "@/lib/api/drop-in-passes";
import { cartSubtotal, payableItems, type CartItem } from "@/lib/pos/cart";
import { getMember, memberDisplayName, type ApiMember } from "@/lib/api/members";
import { newOrderRef, stampOrderRef } from "@/lib/pos/order-ref";

/**
 * Drives a POS checkout.
 *
 * Two rails, both settled by the backend and never by this hook:
 *  - QRIS goes to the backend's AsteriPay redirect page, and the AsteriPay
 *    callback activates the purchase. The POS only polls for the status.
 *  - EDC is charged on the physical terminal; staff record the slip reference
 *    through `PUT /api/v1/payments/{id}`, which runs the same activation.
 *
 * Either way the payment is re-read afterwards and only a backend-reported
 * `Paid` completes a line.
 *
 * Classes are not part of this at all: a class is settled with the member's own
 * entitlement rather than money, so it is booked directly against
 * `POST /api/v1/class-bookings` from the catalogue and never queued behind a
 * checkout it would take no payment for.
 *
 * Drop-ins ride the same endpoint as a membership but carry no plan: they are
 * posted under `PaymentCategory.DropInSingle` / `DropInPass` with a branch, and
 * the backend prices them from that branch's `DROP_IN_*` System Settings. They
 * are then verified: after the backend reports Paid, the member's drop-in passes
 * are re-read to confirm one was actually issued. The payment is real either
 * way, so a failed check never fails the sale; it tells the front desk to issue
 * the pass from the Drop In screen instead of sending the customer away.
 */

/**
 * Payment rails the front desk can take money on.
 *
 * EDC is a single option: the terminal itself decides whether the card runs as
 * debit or credit, so asking staff to pick is both redundant and error-prone.
 */
export type PosPaymentChoice = "qris" | "edc";

export const POS_PAYMENT_CHOICES: Array<{
  value: PosPaymentChoice;
  label: string;
  hint: string;
  icon: string;
}> = [
  { value: "qris", label: "QRIS", hint: "AsteriPay hosted QRIS page", icon: "fa-qrcode" },
  {
    value: "edc",
    label: "EDC",
    hint: "Card charged on the terminal; only the reference is recorded here",
    icon: "fa-credit-card",
  },
];

/**
 * Note stamped on a front-desk payment when staff do not write their own.
 *
 * It has to survive being read out of context in the Payments list, so it says
 * the channel, the branch and the item.
 */
function defaultNote(branchName: string | undefined, itemName: string): string {
  return ["Front Desk", branchName?.trim(), itemName.trim()]
    .filter(Boolean)
    .join(" · ");
}

export function isEdc(choice: PosPaymentChoice): boolean {
  return choice === "edc";
}

/** Attempts and spacing for the post-sale drop-in pass check. */
const DROP_IN_CHECK_ATTEMPTS = 4;
const DROP_IN_CHECK_INTERVAL_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function methodFor(choice: PosPaymentChoice): PaymentMethod {
  // The terminal settles debit vs credit; the record keeps the generic card
  // method and the slip reference identifies the actual transaction.
  return choice === "qris" ? PaymentMethod.QRIS : PaymentMethod.CreditCard;
}

/** QRIS is routed through AsteriPay; EDC is settled off-platform. */
function providerFor(choice: PosPaymentChoice): PaymentProvider {
  return choice === "qris" ? PaymentProvider.AsteriPay : PaymentProvider.Manual;
}

export type StepStatus =
  | "queued"
  | "creating"
  | "awaiting"
  | "confirming"
  | "paid"
  | "failed";

export type CheckoutStep = {
  lineId: string;
  label: string;
  /** Cart price, replaced by the backend `finalAmount` once the payment exists. */
  amount: number;
  status: StepStatus;
  payment: Payment | null;
  /** Backend redirect page that hands the customer to AsteriPay. */
  paymentUrl: string | null;
  /** Backend status label, e.g. "Pending" / "Expired". */
  statusLabel: string | null;
  error: string | null;
  /**
   * Post-sale check on a drop-in line: did the backend actually issue the pass
   * the customer paid for? `skipped` means the check could not run (the
   * pre-sale snapshot failed), which is reported as nothing rather than as a
   * false alarm.
   */
  dropInCheck: "none" | "checking" | "issued" | "missing" | "skipped" | "not-credited";
};

export type CheckoutPhase = "idle" | "paying" | "done" | "blocked";

/**
 * Detects a payment created against the wrong account.
 *
 * Prefers the stable ids — `payment.userId` is the owner the backend actually
 * persisted and `customer.userId` is the account the member is linked to. Names
 * are only consulted for members with no linked account, where no id comparison
 * is possible.
 */
function wrongAccountMessage(payment: Payment, customer: ApiMember): string | null {
  const stop = (detail: string) =>
    `${detail} Transaction stopped — delete this payment from the Payments menu before trying again.`;

  if (customer.userId && payment.userId) {
    return payment.userId.toLowerCase() === customer.userId.toLowerCase()
      ? null
      : stop(
          `The payment was recorded for user ${payment.userId}, not the customer account ${customer.userId}.`
        );
  }

  const onPayment = (payment.memberName ?? "").trim().toLowerCase();
  if (!onPayment) return null;
  const expected = memberDisplayName(customer).trim().toLowerCase();
  if (!expected || onPayment === expected) return null;
  return stop(
    `The payment was recorded under the name "${payment.memberName}", not "${memberDisplayName(customer)}".`
  );
}

export function usePosCheckout(
  items: CartItem[],
  customer: ApiMember | null,
  branchName?: string,
  /** Branch the till is selling from, used when the plan names none. */
  branchId?: string
) {
  const payables = useMemo(() => payableItems(items), [items]);

  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [choice, setChoice] = useState<PosPaymentChoice>("qris");
  const [steps, setSteps] = useState<CheckoutStep[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");
  /**
   * Reference shared by every payment of this checkout.
   *
   * The backend keeps one payment per purchase, so a membership plus a PT
   * package is always two invoices. Stamping both notes with the same reference
   * is what makes them one transaction on the receipt and in the Payments
   * history, without touching the backend.
   */
  const [orderRef, setOrderRef] = useState("");
  const orderRefRef = useRef("");

  /** Guards against a double-click creating two backend payments. */
  const busyRef = useRef(false);
  /** Lines a payment already exists for — never create a second one. */
  const createdRef = useRef<Set<string>>(new Set());
  /** Indexes already advanced past, so a poll tick and a manual refresh cannot
   *  both push the queue forward and create a duplicate next payment. */
  const advancedRef = useRef<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  /**
   * Drop-in pass ids the customer already held when this checkout started.
   * `null` means the snapshot could not be read, and the post-sale check is
   * skipped rather than guessed at.
   */
  const dropInBeforeRef = useRef<Set<string> | null>(null);
  /**
   * The member's own drop-in quota before the sale.
   *
   * A pass row and the member's quota are two different things backend-side,
   * and `ClassBookingService` reads the quota — so a pass that lands without
   * the quota moving is a sale the customer cannot actually use.
   */
  const memberVisitsBeforeRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const updateStep = useCallback((lineId: string, patch: Partial<CheckoutStep>) => {
    setSteps((current) =>
      current.map((step) => (step.lineId === lineId ? { ...step, ...patch } : step))
    );
  }, []);

  const createPaymentForStep = useCallback(
    async (index: number, selected: PosPaymentChoice, notes?: string): Promise<void> => {
      const item = payables[index];
      if (!item || !customer) return;
      if (createdRef.current.has(item.lineId)) return;
      createdRef.current.add(item.lineId);

      updateStep(item.lineId, { status: "creating", error: null });

      const paymentMethod = methodFor(selected);

      // Both of these are priced or resolved per branch backend-side, and both
      // are refused outright without one.
      if ((item.kind === "pt" || item.kind === "dropin") && !item.branchId) {
        createdRef.current.delete(item.lineId);
        updateStep(item.lineId, {
          status: "failed",
          error:
            item.kind === "pt"
              ? "A branch must be selected to purchase a PT package."
              : "A branch must be selected to purchase a drop-in.",
        });
        setPhase("blocked");
        return;
      }

      // Staff notes win. The default is what a finance report needs to read
      // months later: where it was sold and what was sold. Every payment of one
      // checkout carries the same order reference, which is what lets two
      // invoices from a single visit be recognised as one transaction later on.
      const note = stampOrderRef(
        orderRefRef.current,
        notes?.trim() || defaultNote(branchName, item.name)
      );

      try {
        const payment =
          item.kind === "pt"
            ? await purchasePtPackage({
                userId: customer.id,
                ptPackageId: item.pkg.id,
                branchId: item.branchId,
                paymentMethod,
                paymentProvider: providerFor(selected),
              })
            : item.kind === "dropin"
              ? await createDropInPayment({
                  memberId: customer.id,
                  // The branch is the price: the backend reads
                  // DROP_IN_<KIND>_<BRANCH> from System Settings. No plan, and
                  // no method either — a drop-in is always created on the rail
                  // its backend path accepts, and an EDC sale is corrected to a
                  // card payment when the slip number is recorded.
                  branchId: item.branchId,
                  kind: item.dropInKind,
                  notes: note,
                })
              : await createMembershipPayment({
                  // Names the customer; the JWT still identifies the operator.
                  memberId: customer.id,
                  membershipPlanId: item.plan.id,
                  paymentCategory: PaymentCategory.Membership,
                  paymentMethod,
                  paymentProvider: providerFor(selected),
                  // The plan's own branch wins — a PIK2 plan is a PIK2 sale
                  // wherever it is rung up. Plans that predate the branch column
                  // carry none, and sending nothing would leave the backend to
                  // guess which branch merchant settles it, so the branch the
                  // till is open on is the fallback.
                  branchId: item.plan.branchId || branchId,
                  notes: note,
                });

        if (!mountedRef.current) return;

        if (!payment?.id) {
          updateStep(item.lineId, {
            status: "failed",
            error:
              "The payment was created but the backend returned no ID — check the Payments menu before retrying.",
          });
          setPhase("blocked");
          return;
        }

        const mismatch = wrongAccountMessage(payment, customer);
        if (mismatch) {
          updateStep(item.lineId, { payment, status: "failed", error: mismatch });
          setPhase("blocked");
          return;
        }

        updateStep(item.lineId, {
          payment,
          amount: payment.finalAmount ?? payment.amount ?? item.price,
          status: "awaiting",
          statusLabel: paymentStatusMeta(payment.paymentStatus ?? PaymentStatus.Pending).label,
        });

        if (isPaid(payment.paymentStatus)) {
          updateStep(item.lineId, { status: "paid" });
          await advanceAfterPaid(index, selected, notes);
          return;
        }

        // EDC waits here for staff to key in the terminal reference.
        if (isEdc(selected)) return;

        if (!isAsteriPayReady(payment)) {
          updateStep(item.lineId, {
            status: "failed",
            error:
              "The backend has not accepted the AsteriPay checkout for this payment " +
              "(ProviderOrderId/Signature is empty). Check the AsteriPay merchant configuration for that branch.",
          });
          setPhase("blocked");
          return;
        }

        updateStep(item.lineId, { paymentUrl: asteriPayRedirectUrl(payment.id) });
        await watchPayment(index, payment.id);
      } catch (err) {
        // Creation failed, so the POS holds no payment for this line: allow a
        // retry. A drop-in is the exception worth warning about — the backend
        // writes the payment row *before* it calls AsteriPay, so a refused
        // drop-in still leaves a Pending `DIP-` invoice that each retry adds to.
        createdRef.current.delete(item.lineId);
        if (!mountedRef.current) return;
        const message = errorMessageOf(err, "Failed to create payment");
        updateStep(item.lineId, {
          status: "failed",
          error:
            item.kind === "dropin"
              ? `${message} A failed drop-in payment is still stored as Pending in the Payments menu (invoice DIP-) — delete it there, do not retry repeatedly.`
              : message,
        });
        setPhase("blocked");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payables, customer, branchName, branchId, updateStep]
  );

  /** Poll until the backend says the payment settled. Backend is the truth. */
  const watchPayment = useCallback(
    async (index: number, paymentId: string) => {
      const item = payables[index];
      if (!item) return;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await pollPaymentUntilSettled(paymentId, {
          signal: controller.signal,
          onTick: (payment) => {
            if (!mountedRef.current) return;
            updateStep(item.lineId, {
              payment,
              statusLabel: paymentStatusMeta(payment.paymentStatus ?? PaymentStatus.Pending)
                .label,
              amount: payment.finalAmount ?? payment.amount ?? item.price,
            });
          },
        });

        if (!mountedRef.current || result.outcome === "aborted") return;

        if (result.outcome === "timeout") {
          updateStep(item.lineId, {
            status: "failed",
            error:
              "Timed out waiting for payment. The payment still exists in the backend — check its status in the Payments menu before retrying.",
          });
          setPhase("blocked");
          return;
        }

        const payment = result.payment;
        if (isPaid(payment.paymentStatus)) {
          updateStep(item.lineId, { status: "paid", payment, statusLabel: "Paid" });
          await advanceAfterPaid(index);
          return;
        }

        const label = paymentStatusMeta(payment.paymentStatus ?? PaymentStatus.Failed).label;
        updateStep(item.lineId, {
          status: "failed",
          payment,
          statusLabel: label,
          error: `Payment ${label.toLowerCase()}. The transaction was not completed.`,
        });
        setPhase("blocked");
      } catch (err) {
        if (!mountedRef.current) return;
        updateStep(item.lineId, {
          status: "failed",
          error: errorMessageOf(err, "Failed to check payment status"),
        });
        setPhase("blocked");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payables, updateStep]
  );

  /**
   * Confirm the backend really issued the drop-in pass that was just paid for.
   *
   * Activation happens backend-side — on the AsteriPay callback for QRIS, on
   * the status write for EDC — so the pass can land a moment after the payment
   * reads Paid; hence the short retry. Anything that goes wrong here is
   * reported as "unverified", never as a failed sale: the money has already
   * changed hands and the payment record exists either way.
   */
  /**
   * Did the member's bookable drop-in quota actually grow?
   *
   * Verified against the live API on 2026-09-04: a `DropInSingle` purchase
   * raises `remainingDropInVisits`, a `DropInPass` purchase does not — the pass
   * row is written but the member's quota stays put, so the class booking that
   * follows is refused with "No remaining drop-in pass." while the Drop In
   * screen shows a healthy 5-visit pass. Unknowable answers count as credited:
   * a read that fails must not accuse a good sale.
   */
  const isQuotaCredited = useCallback(
    async (expectedVisits: number): Promise<boolean> => {
      const before = memberVisitsBeforeRef.current;
      if (before == null || !customer) return true;
      try {
        const member = await getMember(customer.id, { redirectOn401: false });
        const after = member.remainingDropInVisits ?? 0;
        return after >= before + Math.max(1, expectedVisits) || after > before;
      } catch {
        return true;
      }
    },
    [customer]
  );

  const verifyDropInIssued = useCallback(
    async (item: CartItem) => {
      if (item.kind !== "dropin" || !customer) return;
      const before = dropInBeforeRef.current;
      if (!before) {
        updateStep(item.lineId, { dropInCheck: "skipped" });
        return;
      }

      updateStep(item.lineId, { dropInCheck: "checking" });

      for (let attempt = 0; attempt < DROP_IN_CHECK_ATTEMPTS; attempt++) {
        if (!mountedRef.current) return;
        try {
          const passes = await listMemberDropInPasses(customer.id, {
            redirectOn401: false,
          });
          if (!mountedRef.current) return;
          if (passes.some((pass) => pass.id && !before.has(pass.id))) {
            updateStep(item.lineId, {
              dropInCheck: (await isQuotaCredited(item.visits)) ? "issued" : "not-credited",
            });
            return;
          }
        } catch {
          // A read that fails is not evidence the pass is missing; keep trying
          // and fall through to "missing" only after the last attempt.
        }
        if (attempt < DROP_IN_CHECK_ATTEMPTS - 1) {
          await delay(DROP_IN_CHECK_INTERVAL_MS);
        }
      }

      if (mountedRef.current) updateStep(item.lineId, { dropInCheck: "missing" });
    },
    [customer, updateStep, isQuotaCredited]
  );

  /** Move to the next payment, or finish when the queue is empty. */
  const advanceAfterPaid = useCallback(
    async (index: number, selected?: PosPaymentChoice, notes?: string) => {
      if (advancedRef.current.has(index)) return;
      advancedRef.current.add(index);
      // Deliberately not awaited: the queue must not stall behind a check that
      // only reports on a payment already settled.
      const paidItem = payables[index];
      if (paidItem) void verifyDropInIssued(paidItem);
      const next = index + 1;
      if (next < payables.length) {
        setActiveIndex(next);
        await createPaymentForStep(next, selected ?? choice, notes);
        return;
      }
      busyRef.current = false;
      setPhase("done");
    },
    [payables, choice, createPaymentForStep, verifyDropInIssued]
  );

  /** Kick off checkout. Ignored while a checkout is already running. */
  const start = useCallback(async ({
    choice: selected,
    notes,
  }: {
    choice: PosPaymentChoice;
    notes?: string;
  }) => {
    if (busyRef.current) return;
    if (!customer) {
      setError("Select a customer first.");
      return;
    }
    if (payables.length === 0) {
      setError("There are no payable items in this transaction.");
      return;
    }
    busyRef.current = true;
    createdRef.current.clear();
    advancedRef.current.clear();
    orderRefRef.current = newOrderRef();
    setOrderRef(orderRefRef.current);
    setError("");
    setChoice(selected);
    setActiveIndex(0);

    setSteps(
      payables.map((item) => ({
        lineId: item.lineId,
        label: item.name,
        amount: item.price,
        status: "queued" as const,
        payment: null,
        paymentUrl: null,
        statusLabel: null,
        error: null,
        dropInCheck: "none" as const,
      }))
    );
    setPhase("paying");

    /*
     * Snapshot the passes the customer already holds *before* any money moves,
     * so a pass issued by this sale can be told apart from one bought last
     * week. Only taken when the cart actually contains a drop-in, and a failed
     * read leaves the snapshot null so the check is skipped rather than
     * reporting a pass as missing on no evidence.
     */
    dropInBeforeRef.current = null;
    memberVisitsBeforeRef.current = null;
    if (payables.some((item) => item.kind === "dropin")) {
      try {
        const existing = await listMemberDropInPasses(customer.id, {
          redirectOn401: false,
        });
        dropInBeforeRef.current = new Set(existing.map((pass) => pass.id));
      } catch {
        dropInBeforeRef.current = null;
      }
      try {
        const member = await getMember(customer.id, { redirectOn401: false });
        memberVisitsBeforeRef.current = member.remainingDropInVisits ?? 0;
      } catch {
        memberVisitsBeforeRef.current = null;
      }
    }

    await createPaymentForStep(0, selected, notes);
    busyRef.current = false;
  }, [customer, payables, createPaymentForStep]);

  /**
   * Record the EDC slip reference against the payment that is waiting.
   *
   * The backend runs its existing activation when the status flips to Paid, and
   * the payment is re-read so only a backend-reported Paid completes the line.
   */
  const confirmEdc = useCallback(
    async (transactionNumber: string) => {
      const trimmed = transactionNumber.trim();
      const step = steps[activeIndex];
      if (!step?.payment?.id) return;
      if (!trimmed) {
        updateStep(step.lineId, { error: "The EDC transaction number is required." });
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      updateStep(step.lineId, { status: "confirming", error: null });

      try {
        await confirmEdcPayment(step.payment, trimmed);
        const payment = await getPayment(step.payment.id, { redirectOn401: false });
        if (!mountedRef.current) return;
        const label = paymentStatusMeta(payment.paymentStatus ?? PaymentStatus.Pending).label;
        if (isPaid(payment.paymentStatus)) {
          updateStep(step.lineId, { status: "paid", payment, statusLabel: label });
          busyRef.current = false;
          await advanceAfterPaid(activeIndex);
          return;
        }
        updateStep(step.lineId, {
          status: "failed",
          payment,
          statusLabel: label,
          error: `The backend has not marked this payment as Paid (status: ${label}).`,
        });
        setPhase("blocked");
      } catch (err) {
        if (!mountedRef.current) return;
        updateStep(step.lineId, {
          status: "awaiting",
          error: errorMessageOf(err, "Failed to record EDC payment"),
        });
      } finally {
        busyRef.current = false;
      }
    },
    [steps, activeIndex, updateStep, advanceAfterPaid]
  );

  /** Re-check the active payment on demand, without waiting for the next tick. */
  const refreshActivePayment = useCallback(async () => {
    const step = steps[activeIndex];
    if (!step?.payment?.id) return;
    try {
      const payment = await getPayment(step.payment.id, { redirectOn401: false });
      if (!mountedRef.current) return;
      updateStep(step.lineId, {
        payment,
        statusLabel: paymentStatusMeta(payment.paymentStatus ?? PaymentStatus.Pending).label,
      });
      if (isPaid(payment.paymentStatus)) {
        abortRef.current?.abort();
        updateStep(step.lineId, { status: "paid" });
        await advanceAfterPaid(activeIndex);
      }
    } catch (err) {
      setError(errorMessageOf(err, "Failed to check payment status"));
    }
  }, [steps, activeIndex, updateStep, advanceAfterPaid]);

  /** Stop waiting locally. The backend payment record is left untouched. */
  const cancelWaiting = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    const step = steps[activeIndex];
    if (step) {
      updateStep(step.lineId, {
        status: "failed",
        error:
          "Waiting for payment was cancelled from the POS. The payment still exists in the backend — check the Payments menu before retrying.",
      });
    }
    setPhase("blocked");
  }, [steps, activeIndex, updateStep]);

  /** Resume a blocked checkout, reusing the payment the step already has. */
  const retryActiveStep = useCallback(async () => {
    const step = steps[activeIndex];
    if (!step || busyRef.current) return;
    setPhase("paying");
    if (step.payment?.id) {
      // A payment already exists for this line: never create a second one.
      updateStep(step.lineId, { status: "awaiting", error: null });
      if (!isEdc(choice)) await watchPayment(activeIndex, step.payment.id);
      return;
    }
    busyRef.current = true;
    await createPaymentForStep(activeIndex, choice);
    busyRef.current = false;
  }, [steps, activeIndex, choice, updateStep, watchPayment, createPaymentForStep]);

  const backendTotal = steps.reduce((sum, s) => sum + (s.payment?.finalAmount ?? s.amount), 0);

  /**
   * Payments the backend confirmed as Paid, in the order they were taken.
   *
   * Only these get a receipt: a slip must never be printed for a payment the
   * backend has not settled.
   */
  const paidPaymentIds = useMemo(
    () =>
      steps
        .filter((step) => step.status === "paid" && step.payment?.id)
        .map((step) => step.payment!.id),
    [steps]
  );

  return {
    phase,
    choice,
    orderRef,
    steps,
    activeIndex,
    paidPaymentIds,
    payables,
    subtotal: cartSubtotal(items),
    backendTotal: steps.length > 0 ? backendTotal : cartSubtotal(items),
    error,
    start,
    confirmEdc,
    refreshActivePayment,
    cancelWaiting,
    retryActiveStep,
    isBusy: () => busyRef.current,
  };
}
