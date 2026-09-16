/**
 * Payments, as the API's `PaymentResponseDto` and `CreatePaymentRequestDto`
 * define them.
 *
 * The enums are sent as numbers. The API is configured without
 * `JsonStringEnumConverter`, so `PaymentCategory.Membership` binds from `1`,
 * not from `"Membership"` — sending the name is a 400.
 */

export const PAYMENT_CATEGORY = {
  membership: 1,
  ptPackage: 2,
  dropInSingle: 3,
  dropInPass: 4,
} as const;

export const PAYMENT_PROVIDER = {
  manual: 0,
  midtrans: 1,
  xendit: 2,
  asteriPay: 3,
} as const;

export const PAYMENT_METHOD = {
  cash: 0,
  bankTransfer: 1,
  qris: 2,
  creditCard: 3,
  debitCard: 4,
  eWallet: 5,
  virtualAccount: 6,
} as const;

/** Over-the-counter methods, which settle off-platform. */
export const COUNTER_PAYMENT_METHODS = [
  { value: PAYMENT_METHOD.cash, label: "Cash" },
  { value: PAYMENT_METHOD.bankTransfer, label: "Bank Transfer" },
  { value: PAYMENT_METHOD.qris, label: "QRIS" },
  { value: PAYMENT_METHOD.debitCard, label: "Debit Card" },
  { value: PAYMENT_METHOD.creditCard, label: "Credit Card" },
  { value: PAYMENT_METHOD.eWallet, label: "E-Wallet" },
] as const;

export const PAYMENT_STATUS_LABEL: Record<number, string> = {
  0: "Pending",
  1: "Paid",
  2: "Failed",
  3: "Expired",
  4: "Refunded",
  5: "Cancelled",
};

export const PAYMENT_METHOD_LABEL: Record<number, string> = {
  0: "Cash",
  1: "Bank Transfer",
  2: "QRIS",
  3: "Credit Card",
  4: "Debit Card",
  5: "E-Wallet",
  6: "Virtual Account",
};

export type Payment = {
  id: string;
  userId: string;
  memberName?: string | null;
  branchName?: string | null;
  membershipPlanId?: string | null;
  membershipPlanName?: string | null;
  invoiceNo: string;
  /** List price before any discount, as the backend priced it. */
  amount: number;
  /** The discount the backend applied. Never computed in the browser. */
  discount: number;
  tax: number;
  finalAmount: number;
  paymentMethod: number;
  paymentStatus: number;
  paymentProvider: number;
  redirectUrl?: string | null;
  expiryAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  created: string;
};

export type CreatePaymentRequest = {
  memberId: string;
  membershipPlanId: string;
  branchId: string;
  paymentCategory: number;
  paymentMethod: number;
  paymentProvider: number;
  notes?: string | null;
};

export function paymentStatusTone(status: number) {
  if (status === 1) return "success" as const;
  if (status === 0) return "warning" as const;
  if (status === 4) return "info" as const;
  return "danger" as const;
}
