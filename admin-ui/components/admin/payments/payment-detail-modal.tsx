"use client";

import type { Payment } from "./payments-view";

type Props = {
  payment: Payment;
  onClose: () => void;
};

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function statusBadge(status: number) {
  if (status === 1)
    return {
      label: "Paid",
      class: "bg-green-500/10 text-green-400 border-green-500/30",
    };
  if (status === 0)
    return {
      label: "Pending",
      class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    };
  return {
    label: "Failed",
    class: "bg-red-500/10 text-red-400 border-red-500/30",
  };
}

const METHOD_LABELS: Record<number, string> = {
  0: "Cash",
  1: "Bank Transfer",
  2: "QRIS",
  3: "Credit Card",
  4: "Debit Card",
  5: "E-Wallet",
  6: "Virtual Account",
};

function methodLabel(method: number): string {
  return METHOD_LABELS[method] ?? String(method);
}

function providerLabel(provider: number): string {
  return provider === 0 ? "Offline" : "Midtrans";
}

function SectionHeader({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <i className={`${icon} text-sweat w-4 text-sm`} aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
        {label}
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  if (value == null) return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`text-sm text-right ${
          highlight
            ? "text-green-400 font-bold text-base"
            : "text-gray-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentDetailModal({ payment, onClose }: Props) {
  const badge = statusBadge(payment.paymentStatus);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
                Payment Detail
              </p>
              <p className="text-sm font-mono text-sweat font-bold">
                {payment.invoiceNo}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${badge.class}`}
              >
                {badge.label}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-1">
          {/* Financial */}
          <SectionHeader icon="fas fa-coins" label="Financial" />
          <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
            <Row label="Amount" value={formatRupiah(payment.amount)} />
            <Row label="Discount" value={formatRupiah(payment.discount)} />
            <Row label="Tax" value={formatRupiah(payment.tax)} />
            <Row
              label="Final Amount"
              value={formatRupiah(payment.finalAmount)}
              highlight
            />
          </div>

          {/* Details */}
          <SectionHeader icon="fas fa-clipboard-list" label="Details" />
          <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
            <Row
              label="Plan Name"
              value={payment.membershipPlanName ?? "—"}
            />
            <Row
              label="Payment Method"
              value={methodLabel(payment.paymentMethod)}
            />
            <Row
              label="Provider"
              value={providerLabel(payment.paymentProvider)}
            />
            <Row
              label="Provider Order ID"
              value={payment.providerOrderId ?? "—"}
            />
          </div>

          {/* Timeline */}
          <SectionHeader icon="fas fa-calendar-alt" label="Timeline" />
          <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
            <Row
              label="Created"
              value={new Date(payment.created).toLocaleString("id-ID")}
            />
            <Row
              label="Expiry"
              value={new Date(payment.expiryAt).toLocaleString("id-ID")}
            />
            <Row
              label="Paid At"
              value={
                payment.paidAt
                  ? new Date(payment.paidAt).toLocaleString("id-ID")
                  : null
              }
            />
          </div>

          {/* Notes */}
          {payment.notes && (
            <>
              <SectionHeader icon="fas fa-sticky-note" label="Notes" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                  {payment.notes}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-sidebar border border-border text-gray-300 px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
