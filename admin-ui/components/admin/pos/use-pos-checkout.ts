"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import {
  PaymentCategory,
  PaymentMethod,
  PaymentProvider,
  asteriPayRedirectUrl,
  confirmEdcPayment,
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
import {
  cartSubtotal,
  payableItems,
  type CartItem,
  type DropInCartItem,
  type MembershipCartItem,
} from "@/lib/pos/cart";
import { memberDisplayName, type ApiMember } from "@/lib/api/members";

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
 * Drop-ins ride the same rails as a membership — one `POST /api/v1/payments`,
 * only under `PaymentCategory.DropInSingle` / `DropInPass` — and are then
 * verified: after the backend reports Paid, the member's drop-in passes are
 * re-read to confirm one was actually issued. The payment is real either way,
 * so a failed check never fails the sale; it tells the front desk to issue the
 * pass from the Drop In screen instead of sending the customer away.
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

/**
 * Which backend category a plan-backed line is charged under.
 *
 * Same endpoint and same plan record for both; the category is the whole
 * difference between starting a membership and issuing a drop-in pass.
 */
function paymentCategoryFor(item: MembershipCartItem | DropInCartItem): PaymentCategory {
  if (item.kind === "membership") return PaymentCategory.Membership;
  return item.dropInKind === "pass"
    ? PaymentCategory.DropInPass
    : PaymentCategory.DropInSingle;
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
  dropInCheck: "none" | "checking" | "issued" | "missing" | "skipped";
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
    `${detail} Transaksi dihentikan — hapus payment ini dari menu Payments sebelum mencoba lagi.`;

  if (customer.userId && payment.userId) {
    return payment.userId.toLowerCase() === customer.userId.toLowerCase()
      ? null
      : stop(
          `Payment tercatat untuk user ${payment.userId}, bukan akun customer ${customer.userId}.`
        );
  }

  const onPayment = (payment.memberName ?? "").trim().toLowerCase();
  if (!onPayment) return null;
  const expected = memberDisplayName(customer).trim().toLowerCase();
  if (!expected || onPayment === expected) return null;
  return stop(
    `Payment tercatat atas nama "${payment.memberName}", bukan "${memberDisplayName(customer)}".`
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

      if (item.kind === "pt" && !item.branchId) {
        createdRef.current.delete(item.lineId);
        updateStep(item.lineId, {
          status: "failed",
          error: "Branch wajib dipilih untuk pembelian PT package.",
        });
        setPhase("blocked");
        return;
      }

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
            : await createMembershipPayment({
                // Names the customer; the JWT still identifies the operator.
                memberId: customer.id,
                membershipPlanId: item.plan.id,
                // Membership, drop-in single or drop-in pass — the plan record
                // is the same shape, the category is what the backend acts on.
                paymentCategory: paymentCategoryFor(item),
                paymentMethod,
                paymentProvider: providerFor(selected),
                // The plan's own branch wins — a PIK2 plan is a PIK2 sale
                // wherever it is rung up. Plans that predate the branch column
                // carry none, and sending nothing would leave the backend to
                // guess which branch merchant settles it, so the branch the
                // till is open on is the fallback.
                branchId: item.plan.branchId || branchId,
                // Staff notes win. The default is what a finance report needs
                // to read months later: where it was sold and what was sold —
                // not the literal word "POS" followed by a plan name, which is
                // what this used to write.
                notes: notes?.trim() || defaultNote(branchName, item.name),
              });

        if (!mountedRef.current) return;

        if (!payment?.id) {
          updateStep(item.lineId, {
            status: "failed",
            error:
              "Payment dibuat tapi backend tidak mengembalikan ID — cek menu Payments sebelum mengulang.",
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
              "Backend belum menerima checkout AsteriPay untuk payment ini " +
              "(ProviderOrderId/Signature kosong). Cek konfigurasi merchant AsteriPay untuk branch tersebut.",
          });
          setPhase("blocked");
          return;
        }

        updateStep(item.lineId, { paymentUrl: asteriPayRedirectUrl(payment.id) });
        await watchPayment(index, payment.id);
      } catch (err) {
        // Creation failed, so no backend record exists: allow a retry.
        createdRef.current.delete(item.lineId);
        if (!mountedRef.current) return;
        updateStep(item.lineId, {
          status: "failed",
          error: errorMessageOf(err, "Gagal membuat payment"),
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
              "Timeout menunggu pembayaran. Payment tetap ada di backend — cek statusnya di menu Payments sebelum mengulang.",
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
          error: `Pembayaran ${label.toLowerCase()}. Transaksi belum diselesaikan.`,
        });
        setPhase("blocked");
      } catch (err) {
        if (!mountedRef.current) return;
        updateStep(item.lineId, {
          status: "failed",
          error: errorMessageOf(err, "Gagal memeriksa status pembayaran"),
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
            updateStep(item.lineId, { dropInCheck: "issued" });
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
    [customer, updateStep]
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
      setError("Pilih customer terlebih dahulu.");
      return;
    }
    if (payables.length === 0) {
      setError("Belum ada item berbayar di transaksi ini.");
      return;
    }
    busyRef.current = true;
    createdRef.current.clear();
    advancedRef.current.clear();
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
    if (payables.some((item) => item.kind === "dropin")) {
      try {
        const existing = await listMemberDropInPasses(customer.id, {
          redirectOn401: false,
        });
        dropInBeforeRef.current = new Set(existing.map((pass) => pass.id));
      } catch {
        dropInBeforeRef.current = null;
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
        updateStep(step.lineId, { error: "Nomor transaksi EDC wajib diisi." });
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
          error: `Backend belum menandai payment ini Paid (status: ${label}).`,
        });
        setPhase("blocked");
      } catch (err) {
        if (!mountedRef.current) return;
        updateStep(step.lineId, {
          status: "awaiting",
          error: errorMessageOf(err, "Gagal mencatat pembayaran EDC"),
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
      setError(errorMessageOf(err, "Gagal memeriksa status pembayaran"));
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
          "Menunggu pembayaran dibatalkan dari POS. Payment masih ada di backend — cek menu Payments sebelum mengulang.",
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
