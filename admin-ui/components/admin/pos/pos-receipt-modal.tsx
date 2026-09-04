"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { errorMessageOf } from "@/lib/api/http";
import {
  emailPaymentReceipt,
  getPaymentReceipt,
  type PaymentReceipt,
} from "@/lib/api/payments";
import { formatRupiah } from "@/lib/pos/cart";

type Props = {
  /** Payments settled in this transaction, in the order they were taken. */
  paymentIds: string[];
  /**
   * Reference the POS stamped on every payment of this checkout.
   *
   * The backend issues one invoice per purchase, so a membership plus a PT
   * package settles as two payments. This is what makes them one transaction on
   * paper: a single slip, one total, both invoice numbers on it.
   */
  orderRef?: string;
  /** Pre-filled recipient, normally the member's own address. */
  defaultEmail?: string | null;
  onClose: () => void;
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="receipt-value">{value}</td>
    </tr>
  );
}

/**
 * One 80 mm receipt.
 *
 * Rendered at the real paper width so what staff see on screen is what the
 * roll prints — the print stylesheet only strips the surrounding chrome, it
 * does not re-lay-out the slip.
 */
function Receipt({ receipt }: { receipt: PaymentReceipt }) {
  return (
    <div className="receipt-80 mx-auto bg-white p-3 rounded shadow-lg">
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>SWEATBOX</div>
        <div>{receipt.branchName || "-"}</div>
      </div>

      <hr className="receipt-rule" />

      <table>
        <tbody>
          <Line label="Invoice" value={receipt.invoiceNo} />
          <Line label="Date" value={formatDateTime(receipt.paidAt ?? receipt.issuedAt)} />
          <Line label="Member" value={receipt.memberName || "-"} />
          {receipt.memberCode ? <Line label="Code" value={receipt.memberCode} /> : null}
          {receipt.cashierName ? <Line label="Cashier" value={receipt.cashierName} /> : null}
        </tbody>
      </table>

      <hr className="receipt-rule" />

      <div style={{ fontWeight: 700 }}>{receipt.itemName || receipt.itemCategory}</div>

      <table>
        <tbody>
          <Line label="Subtotal" value={formatRupiah(receipt.amount)} />
          {receipt.discount > 0 ? (
            <Line label="Discount" value={`-${formatRupiah(receipt.discount)}`} />
          ) : null}
          {receipt.tax > 0 ? <Line label="Tax" value={formatRupiah(receipt.tax)} /> : null}
          <tr style={{ fontWeight: 700, fontSize: 11 }}>
            <td>TOTAL</td>
            <td className="receipt-value">{formatRupiah(receipt.finalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <hr className="receipt-rule" />

      <table>
        <tbody>
          <Line label="Method" value={receipt.paymentMethod} />
          <Line label="Status" value={receipt.paymentStatus} />
          {receipt.referenceNo ? <Line label="Ref" value={receipt.referenceNo} /> : null}
        </tbody>
      </table>

      <hr className="receipt-rule" />

      <div style={{ textAlign: "center" }}>Thank you — see you next time</div>
    </div>
  );
}

/**
 * One slip for a transaction that produced several invoices.
 *
 * Same paper, same layout as a single-payment slip; the item block becomes a
 * list, each line carrying its own invoice number so the printed slip still
 * reconciles against the two backend records it came from.
 */
function CombinedReceipt({
  receipts,
  orderRef,
}: {
  receipts: PaymentReceipt[];
  orderRef?: string;
}) {
  const first = receipts[0];
  const sum = (pick: (r: PaymentReceipt) => number) =>
    receipts.reduce((total, r) => total + (pick(r) || 0), 0);
  const unique = (values: Array<string | null | undefined>) =>
    Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== "")));

  const paidAt = receipts.map((r) => r.paidAt ?? r.issuedAt).filter(Boolean).pop();
  const methods = unique(receipts.map((r) => r.paymentMethod));
  const statuses = unique(receipts.map((r) => r.paymentStatus));
  const references = unique(receipts.map((r) => r.referenceNo));

  return (
    <div className="receipt-80 mx-auto bg-white p-3 rounded shadow-lg">
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>SWEATBOX</div>
        <div>{first.branchName || "-"}</div>
      </div>

      <hr className="receipt-rule" />

      <table>
        <tbody>
          {orderRef ? <Line label="Transaction" value={orderRef} /> : null}
          <Line label="Date" value={formatDateTime(paidAt)} />
          <Line label="Member" value={first.memberName || "-"} />
          {first.memberCode ? <Line label="Code" value={first.memberCode} /> : null}
          {first.cashierName ? <Line label="Cashier" value={first.cashierName} /> : null}
        </tbody>
      </table>

      <hr className="receipt-rule" />

      {receipts.map((r) => (
        <div key={r.paymentId} style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 700 }}>{r.itemName || r.itemCategory}</div>
          <table>
            <tbody>
              <Line label={r.invoiceNo} value={formatRupiah(r.finalAmount)} />
            </tbody>
          </table>
        </div>
      ))}

      <hr className="receipt-rule" />

      <table>
        <tbody>
          <Line label="Subtotal" value={formatRupiah(sum((r) => r.amount))} />
          {sum((r) => r.discount) > 0 ? (
            <Line label="Discount" value={`-${formatRupiah(sum((r) => r.discount))}`} />
          ) : null}
          {sum((r) => r.tax) > 0 ? (
            <Line label="Tax" value={formatRupiah(sum((r) => r.tax))} />
          ) : null}
          <tr style={{ fontWeight: 700, fontSize: 11 }}>
            <td>TOTAL</td>
            <td className="receipt-value">{formatRupiah(sum((r) => r.finalAmount))}</td>
          </tr>
        </tbody>
      </table>

      <hr className="receipt-rule" />

      <table>
        <tbody>
          <Line label="Method" value={methods.join(" / ") || "-"} />
          <Line label="Status" value={statuses.join(" / ") || "-"} />
          {references.length > 0 ? <Line label="Ref" value={references.join(" / ")} /> : null}
        </tbody>
      </table>

      <hr className="receipt-rule" />

      <div style={{ textAlign: "center" }}>Thank you — see you next time</div>
    </div>
  );
}

/**
 * Receipt viewer for a completed POS transaction.
 *
 * Printing goes through the browser's own print dialog: the app shell is hidden
 * by `@media print` and only this portal — a direct child of `<body>`, which is
 * what makes that rule work — is left on the page, sized for an 80 mm roll.
 *
 * Emailing is a backend call; the body is rendered server-side from the same
 * payment record, so the customer's paper and email copies cannot drift apart.
 */
export function PosReceiptModal({ paymentIds, orderRef, defaultEmail, onClose }: Props) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState(defaultEmail?.trim() ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [emailError, setEmailError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.allSettled(paymentIds.map((id) => getPaymentReceipt(id)))
      .then((results) => {
        if (cancelled) return;
        const ok = results
          .filter(
            (r): r is PromiseFulfilledResult<PaymentReceipt> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value);
        const failed = results.filter((r) => r.status === "rejected");

        setReceipts(ok);
        if (ok.length === 0 && failed.length > 0) {
          setError(
            errorMessageOf(
              (failed[0] as PromiseRejectedResult).reason,
              "Failed to load receipt"
            )
          );
        } else if (failed.length > 0) {
          setError(`${failed.length} receipts failed to load.`);
        }
        // Prefer the address the backend has on file for the payer.
        setEmail((current) => current || ok[0]?.memberEmail || "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paymentIds]);

  const canEmail = useMemo(
    () => receipts.length > 0 && /\S+@\S+\.\S+/.test(email.trim()),
    [receipts.length, email]
  );

  async function sendEmail() {
    if (!canEmail || sending) return;
    setSending(true);
    setEmailError("");
    setSent("");
    try {
      // One mail per payment, matching the one-receipt-per-payment model.
      for (const receipt of receipts) {
        await emailPaymentReceipt(receipt.paymentId, email.trim());
      }
      setSent(`Receipt sent to ${email.trim()}.`);
    } catch (err) {
      setEmailError(errorMessageOf(err, "Failed to send receipt"));
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="receipt-print-root fixed inset-0 z-[60] bg-overlay backdrop-blur-sm overflow-y-auto p-4 flex items-start justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md my-4">
        <div className="receipt-print-hide bg-card border border-border rounded-t-2xl px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold font-display uppercase text-fg">Receipt</h3>
            <p className="text-xs text-muted mt-0.5">
              {loading
                ? "Loading…"
                : receipts.length > 1
                  ? `1 slip · ${receipts.length} invoices · thermal 80 mm`
                  : "1 slip · thermal 80 mm"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="receipt-print-hide bg-card border-x border-border px-5 py-3 space-y-3">
          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || receipts.length === 0}
              className="flex-1 bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-print mr-2" aria-hidden />
              Print Receipt
            </button>
          </div>

          <div>
            <label className="block">
              <span className="text-muted text-xs uppercase font-bold">
                Send receipt to email
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email member"
                  className="flex-1 min-w-0 bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-sweat"
                />
                <button
                  type="button"
                  onClick={() => void sendEmail()}
                  disabled={!canEmail || sending}
                  className="px-4 bg-sidebar border border-border text-fg rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </label>
            {!loading && receipts.length > 1 && (
              <p className="text-[11px] text-muted mt-1">
                The backend sends one email per invoice, so the member receives {receipts.length}{" "}
                emails for this transaction. The printed slip is still a single sheet.
              </p>
            )}
            {!loading && receipts.length > 0 && !receipts[0].memberEmail && (
              <p className="text-[11px] text-muted mt-1">
                This member has no email on file — enter one manually to send.
              </p>
            )}
            {sent && <p className="text-xs text-green-500 mt-1">{sent}</p>}
            {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-b-2xl px-5 py-5 space-y-5">
          {loading ? (
            <p className="text-sm text-muted text-center py-8">Loading receipt…</p>
          ) : receipts.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No receipts to display.
            </p>
          ) : receipts.length > 1 ? (
            // One transaction, one slip — even though the backend recorded it
            // as several payments.
            <CombinedReceipt receipts={receipts} orderRef={orderRef} />
          ) : (
            <Receipt receipt={receipts[0]} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
