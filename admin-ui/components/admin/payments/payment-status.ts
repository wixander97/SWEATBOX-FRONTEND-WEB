/**
 * Shared PaymentStatus enum + label/badge metadata, aligned with the backend
 * `PaymentStatus` enum:
 *   Pending(0), Paid(1), Failed(2), Expired(3), Refunded(4), Cancelled(5).
 *
 * Any value outside 0–5 is rendered as "Unknown".
 */
export enum PaymentStatus {
  Pending = 0,
  Paid = 1,
  Failed = 2,
  Expired = 3,
  Refunded = 4,
  Cancelled = 5,
}

export type PaymentStatusMeta = {
  label: string;
  class: string;
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, PaymentStatusMeta> = {
  [PaymentStatus.Pending]: {
    label: "Pending",
    class: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  [PaymentStatus.Paid]: {
    label: "Paid",
    class: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  [PaymentStatus.Failed]: {
    label: "Failed",
    class: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  [PaymentStatus.Expired]: {
    label: "Expired",
    class: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  [PaymentStatus.Refunded]: {
    label: "Refunded",
    class: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  [PaymentStatus.Cancelled]: {
    label: "Cancelled",
    class: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
};

const UNKNOWN_META: PaymentStatusMeta = {
  label: "Unknown",
  class: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

/** Resolve label + badge class for a numeric payment status. Unknown → "Unknown". */
export function paymentStatusMeta(status: number): PaymentStatusMeta {
  return PAYMENT_STATUS_META[status as PaymentStatus] ?? UNKNOWN_META;
}