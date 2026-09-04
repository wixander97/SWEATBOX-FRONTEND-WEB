import { apiGet, apiPost, apiPut, apiUrl, toList, type PagedResponse, type RequestOptions } from "./http";
import { PaymentStatus } from "@/components/admin/payments/payment-status";

/**
 * Payments service.
 *
 * Wraps the existing backend `PaymentsController`. AsteriPay is never contacted
 * from the browser: the POS only ever talks to the Sweatbox API, and the
 * payment status returned by the backend is the single source of truth.
 */

/** Backend `SWEATBOX_DOMAIN.Enums.PaymentMethod`. */
export enum PaymentMethod {
  Cash = 0,
  BankTransfer = 1,
  QRIS = 2,
  CreditCard = 3,
  DebitCard = 4,
  EWallet = 5,
  VirtualAccount = 6,
}

/**
 * Backend `SWEATBOX_DOMAIN.Enums.PaymentProvider`.
 *
 * Mind the ordering: AsteriPay is 3, not 1 — 1 is Midtrans.
 */
export enum PaymentProvider {
  Manual = 0,
  Midtrans = 1,
  Xendit = 2,
  AsteriPay = 3,
}

/** Backend `SWEATBOX_DOMAIN.Enums.PaymentCategory`. One-based, not zero-based. */
export enum PaymentCategory {
  Membership = 1,
  PTPackage = 2,
  DropInSingle = 3,
  DropInPass = 4,
}

/** Payment record returned by `GET /api/v1/payments/{id}`. */
export type Payment = {
  id: string;
  userId?: string;
  memberName?: string | null;
  branchName?: string | null;
  membershipPlanId?: string | null;
  membershipPlanName?: string | null;
  invoiceNo?: string | null;
  amount?: number;
  discount?: number;
  tax?: number;
  finalAmount?: number;
  paymentMethod?: number;
  paymentStatus?: number;
  paymentProvider?: number;
  asteriPaySignature?: string | null;
  providerTransactionId?: string | null;
  providerOrderId?: string | null;
  snapToken?: string | null;
  redirectUrl?: string | null;
  expiryAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  created?: string;
  lastModified?: string | null;
};

/** `GET /api/v1/payments/payment-methods` → `PaymentMethodOptionResponse`. */
export type PaymentMethodOption = {
  paymentMethod: number;
  paymentMethodName?: string | null;
};

/**
 * Body accepted by `POST /api/v1/payments` (`CreatePaymentRequestDto`).
 *
 * `memberId` names the customer the payment belongs to; the JWT still identifies
 * the operator, who is recorded as `CreatedByUserId`. Omitting it keeps the
 * original self-service behaviour where the payment belongs to the caller.
 */
export type CreatePaymentRequest = {
  memberId: string;
  /**
   * Required for a membership (the backend answers "Membership plan is
   * required." without it) and meaningless for a drop-in, which is priced from
   * the branch's settings instead.
   */
  membershipPlanId?: string;
  paymentCategory: PaymentCategory;
  paymentMethod: PaymentMethod;
  paymentProvider: PaymentProvider;
  branchId?: string;
  notes?: string;
};

/**
 * Body accepted by `PUT /api/v1/payments/{id}` (`UpdatePaymentRequestDto`).
 *
 * The backend assigns `PaymentMethod`, `PaymentStatus` and `Notes`
 * unconditionally, so every call must carry the payment's current values for
 * the fields it does not mean to change.
 */
export type UpdatePaymentRequest = {
  /**
   * Omitted for a drop-in, which has no plan: the backend leaves the column
   * null rather than rejecting the write (verified against the live API).
   */
  membershipPlanId?: string;
  amount: number;
  discount: number;
  tax: number;
  paymentMethod: PaymentMethod;
  /** Not part of the documented DTO; ignored by builds that do not read it. */
  paymentProvider?: PaymentProvider;
  paymentStatus: PaymentStatus;
  providerTransactionId?: string;
  notes?: string | null;
};

export function createMembershipPayment(
  body: CreatePaymentRequest,
  options?: RequestOptions
): Promise<Payment> {
  return apiPost<Payment>("/api/v1/payments", body, {
    errorMessage: "Gagal membuat payment",
    ...options,
  });
}

/**
 * Buy a drop-in visit or a multi-visit pass.
 *
 * Same endpoint as a membership, but a genuinely different purchase: there is
 * no drop-in plan and none is sent. The backend prices it from the branch's own
 * System Settings rows (`DROP_IN_SINGLE_<BRANCH>` / `DROP_IN_PASS_<BRANCH>`,
 * with `_VISITS` and `_VALIDITY_DAYS`), issues a `DIP-` invoice, and creates the
 * `MemberDropInPass` once the payment settles. Sending a branch is therefore not
 * optional — without it the backend answers "Branch is required."
 *
 * The method is fixed, and that is not an oversight. Unlike a membership, the
 * backend's drop-in path always registers the payment with AsteriPay and
 * refuses anything AsteriPay does not sell: a create carrying `CreditCard`
 * comes back "Unsupported AsteriPay payment method: CreditCard" (AsteriPay
 * offers QRIS and VirtualAccount only) — and the refused attempt still leaves a
 * Pending `DIP-` row behind. A card taken on the terminal is therefore created
 * here like any other drop-in and corrected on the confirmation write, which is
 * what `confirmEdcPayment` does: it sets the method to `CreditCard`, the
 * provider to `Manual` and the slip number, exactly as for a membership.
 */
export function createDropInPayment(
  body: {
    memberId: string;
    branchId: string;
    kind: "single" | "pass";
    notes?: string;
  },
  options?: RequestOptions
): Promise<Payment> {
  const { kind, ...rest } = body;
  return apiPost<Payment>(
    "/api/v1/payments",
    {
      ...rest,
      paymentCategory:
        kind === "pass" ? PaymentCategory.DropInPass : PaymentCategory.DropInSingle,
      paymentMethod: PaymentMethod.QRIS,
      paymentProvider: PaymentProvider.AsteriPay,
    },
    { errorMessage: "Gagal membuat payment drop-in", ...options }
  );
}

/**
 * Record a card payment taken on the physical EDC terminal.
 *
 * The terminal performs the card transaction; the POS stores only the reference
 * printed on the merchant slip. No card data ever reaches this app. Marking the
 * payment Paid is what makes the backend run its existing activation, so the
 * caller must still re-read the payment and trust only the status it returns.
 */
export function confirmEdcPayment(
  payment: Payment,
  transactionNumber: string,
  options?: RequestOptions
): Promise<Payment> {
  const body: UpdatePaymentRequest = {
    // Carry the record's current values through, since the backend overwrites
    // these fields whether or not they were meant to change. A drop-in carries
    // no plan, and sending an empty GUID for one would be inventing a
    // relationship the record does not have.
    ...(payment.membershipPlanId ? { membershipPlanId: payment.membershipPlanId } : {}),
    amount: payment.amount ?? 0,
    discount: payment.discount ?? 0,
    tax: payment.tax ?? 0,
    // This *is* the card-on-the-terminal write, so the method is not read off
    // the record: a drop-in is necessarily created as QRIS (the only rail its
    // backend path accepts) and becomes a card payment here.
    paymentMethod: PaymentMethod.CreditCard,
    paymentProvider: PaymentProvider.Manual,
    paymentStatus: PaymentStatus.Paid,
    providerTransactionId: transactionNumber,
    notes: payment.notes ?? null,
  };
  return apiPut<Payment>(`/api/v1/payments/${encodeURIComponent(payment.id)}`, body, {
    errorMessage: "Gagal mencatat pembayaran EDC",
    ...options,
  });
}

/**
 * Body accepted by `POST /api/v1/payments/pt-package` (`PurchasePTPackageRequest`).
 *
 * `userId` is the **member id** — the service resolves it through the member
 * repository. Price, session count and coach all come from the PT package
 * record, and the backend always routes this purchase through AsteriPay.
 */
export type PurchasePtPackageRequest = {
  userId: string;
  ptPackageId: string;
  branchId: string;
  paymentMethod: PaymentMethod;
  /**
   * Omitted keeps the AsteriPay checkout (what member/mobile purchases do).
   * `Manual` is used when the card is charged on an EDC terminal.
   */
  paymentProvider?: PaymentProvider;
};

/** Statuses that end a polling cycle — nothing more will change on its own. */
const TERMINAL_STATUSES: ReadonlySet<number> = new Set([
  PaymentStatus.Paid,
  PaymentStatus.Failed,
  PaymentStatus.Expired,
  PaymentStatus.Refunded,
  PaymentStatus.Cancelled,
]);

export function isTerminalStatus(status: number | undefined | null): boolean {
  return status != null && TERMINAL_STATUSES.has(status);
}

export function isPaid(status: number | undefined | null): boolean {
  return status === PaymentStatus.Paid;
}

/** Enabled payment methods for a provider, e.g. `AsteriPay`. Never throws. */
export async function listPaymentMethods(
  provider: PaymentProvider = PaymentProvider.AsteriPay
): Promise<PaymentMethodOption[]> {
  try {
    const payload = await apiGet<PaymentMethodOption[] | PagedResponse<PaymentMethodOption>>(
      `/api/v1/payments/payment-methods?provider=${provider}`,
      { errorMessage: "Gagal memuat payment method" }
    );
    return toList(payload);
  } catch {
    return [];
  }
}

export function purchasePtPackage(
  body: PurchasePtPackageRequest,
  options?: RequestOptions
): Promise<Payment> {
  return apiPost<Payment>("/api/v1/payments/pt-package", body, {
    errorMessage: "Gagal membuat payment PT package",
    ...options,
  });
}

export function getPayment(id: string, options?: RequestOptions): Promise<Payment> {
  return apiGet<Payment>(`/api/v1/payments/${encodeURIComponent(id)}`, {
    errorMessage: "Gagal memuat status payment",
    ...options,
  });
}

/**
 * URL of the backend page that hands the customer to AsteriPay.
 *
 * `GET /api/v1/payments/{id}/asteripay/redirect` is `[AllowAnonymous]` and
 * returns an HTML page that auto-POSTs `CheckoutID` + `Signature` to AsteriPay's
 * payment page. It is therefore opened directly in a tab — never fetched and
 * never parsed here, and the AsteriPay credentials stay entirely backend-side.
 */
export function asteriPayRedirectUrl(paymentId: string): string {
  return apiUrl(`/api/v1/payments/${encodeURIComponent(paymentId)}/asteripay/redirect`);
}

/**
 * Whether the backend managed to register this payment with AsteriPay.
 *
 * The redirect endpoint 400s without both values, so the POS checks up front
 * rather than opening a tab onto an error page.
 */
export function isAsteriPayReady(payment: Payment): boolean {
  return Boolean(payment.providerOrderId && payment.asteriPaySignature);
}

export type PollOptions = {
  /** Called after every successful status read. */
  onTick?: (payment: Payment) => void;
  /** Hard stop, in milliseconds. Defaults to 10 minutes. */
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type PollResult =
  | { outcome: "settled"; payment: Payment }
  | { outcome: "timeout"; payment: Payment | null }
  | { outcome: "aborted"; payment: Payment | null };

/**
 * Poll `GET /api/v1/payments/{id}` until the status is terminal.
 *
 * Deliberately unhurried: every 5s for the first two minutes (when the customer
 * is actually scanning), then every 10s. Stops on Paid / Failed / Expired /
 * Cancelled / Refunded, on timeout, or when the caller aborts.
 */
export async function pollPaymentUntilSettled(
  paymentId: string,
  { onTick, timeoutMs = 10 * 60 * 1000, signal }: PollOptions = {}
): Promise<PollResult> {
  const startedAt = Date.now();
  let last: Payment | null = null;
  let consecutiveErrors = 0;

  while (true) {
    if (signal?.aborted) return { outcome: "aborted", payment: last };
    if (Date.now() - startedAt >= timeoutMs) return { outcome: "timeout", payment: last };

    const elapsed = Date.now() - startedAt;
    const delay = elapsed < 2 * 60 * 1000 ? 5000 : 10000;
    const settled = await sleep(delay, signal);
    if (!settled) return { outcome: "aborted", payment: last };

    try {
      const payment = await getPayment(paymentId, { redirectOn401: false, signal });
      consecutiveErrors = 0;
      last = payment;
      onTick?.(payment);
      if (isTerminalStatus(payment.paymentStatus)) {
        return { outcome: "settled", payment };
      }
    } catch (err) {
      if (signal?.aborted) return { outcome: "aborted", payment: last };
      consecutiveErrors += 1;
      // Transient backend/network problems must not fail the payment; only give
      // up after a sustained outage so staff get an actionable message.
      if (consecutiveErrors >= 10) throw err;
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      resolve(false);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/* -------------------------------------------------------------------------
   Receipts
   ------------------------------------------------------------------------- */

/**
 * Receipt projection returned by `GET /api/v1/payments/{id}/receipt`.
 *
 * Resolved backend-side from the payment record, so the printed slip and the
 * emailed copy are rendered from identical data.
 */
export type PaymentReceipt = {
  paymentId: string;
  invoiceNo: string;
  branchName: string;
  memberName: string;
  memberEmail: string;
  memberCode: string;
  itemName: string;
  itemCategory: string;
  amount: number;
  discount: number;
  tax: number;
  finalAmount: number;
  /** Display label, e.g. "QRIS" or "Card (EDC)". */
  paymentMethod: string;
  paymentStatus: string;
  /** EDC slip number, or the gateway reference for an online rail. */
  referenceNo?: string | null;
  cashierName: string;
  issuedAt: string;
  paidAt?: string | null;
  notes?: string | null;
};

export function getPaymentReceipt(
  paymentId: string,
  options?: RequestOptions
): Promise<PaymentReceipt> {
  return apiGet<PaymentReceipt>(
    `/api/v1/payments/${encodeURIComponent(paymentId)}/receipt`,
    { errorMessage: "Gagal memuat receipt", ...options }
  );
}

/**
 * Email the receipt to the member.
 *
 * `email` is optional and only overrides the recipient; the receipt body is
 * always composed by the backend from the payment itself, so this can never be
 * used to mail arbitrary content to a customer.
 */
export function emailPaymentReceipt(
  paymentId: string,
  email?: string,
  options?: RequestOptions
): Promise<{ message?: string; email?: string }> {
  return apiPost<{ message?: string; email?: string }>(
    `/api/v1/payments/${encodeURIComponent(paymentId)}/receipt/email`,
    { email: email?.trim() || null },
    { errorMessage: "Gagal mengirim receipt", ...options }
  );
}
