"use client";

import type { Payment } from "./payments-view";
import { paymentStatusMeta } from "./payment-status";
import { noteWithoutOrderRef, parseOrderRef } from "@/lib/pos/order-ref";

type Props = {
  payment: Payment;
  onClose: () => void;
};

function formatRupiah(amount: number): string {
  return amount.toLocaleString("id-ID");
}

function statusBadge(status: number) {
  return paymentStatusMeta(status);
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
  return provider === 0 ? "Offline" : "AsteriPay";
}

/**
 * What the reference on the record actually is.
 *
 * `providerTransactionId` holds the EDC slip number for a card charged on the
 * terminal (provider `Manual`/Offline) and the gateway reference for an online
 * rail, so the label has to say which one the reader is looking at.
 */
function transactionLabel(provider: number): string {
  return provider === 0 ? "No. Transaksi EDC" : "Transaction ID";
}

/**
 * A timestamp, or nothing.
 *
 * An unset date reaches the browser as `null`, an empty string or
 * `0001-01-01`/epoch, all of which `toLocaleString` happily renders as
 * "1/1/1970" — a date that never happened and reads as real. Nothing is shown
 * instead, and the row disappears.
 */
function formatDateTime(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) return null;
  return date.toLocaleString("id-ID");
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
      <i className={`${icon} text-accent-ink w-4 text-sm`} aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-muted">
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
    <div className="flex justify-between items-start gap-3 py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span
        className={`text-sm text-right break-all min-w-0 flex-1 ${highlight
          ? "text-success font-bold text-base"
          : "text-fg-soft"
          }`}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentDetailModal({ payment, onClose }: Props) {
  const badge = statusBadge(payment.paymentStatus);
  const orderRef = parseOrderRef(payment.notes);
  const notes = noteWithoutOrderRef(payment.notes);

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                Payment Detail
              </p>
              <p className="text-sm font-mono text-accent-ink font-bold">
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
                className="text-muted hover:text-fg text-xl leading-none"
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
              label={transactionLabel(payment.paymentProvider)}
              value={payment.providerTransactionId || "—"}
            />
            <Row
              label="Provider Order ID"
              value={payment.providerOrderId ?? "—"}
            />
            {/* One front-desk transaction can produce several invoices — a
                membership and a PT package are two backend payments. The POS
                stamps the same reference on each, so this is what ties them
                together. */}
            <Row label="Order Ref" value={orderRef ?? "—"} />
          </div>

          {/* Timeline */}
          <SectionHeader icon="fas fa-calendar-alt" label="Timeline" />
          <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
            <Row label="Created" value={formatDateTime(payment.created)} />
            <Row label="Expiry" value={formatDateTime(payment.expiryAt)} />
            <Row label="Paid At" value={formatDateTime(payment.paidAt)} />
          </div>

          {/* Notes */}
          {notes && (
            <>
              <SectionHeader icon="fas fa-sticky-note" label="Notes" />
              <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
                <p className="text-sm text-fg-soft whitespace-pre-wrap">{notes}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-sidebar border border-border text-fg-soft px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-fg transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
