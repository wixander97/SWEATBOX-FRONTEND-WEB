"use client";

import { useEffect, useState } from "react";

import { formatRupiah, type CartItem } from "@/lib/pos/cart";
import { memberDisplayName, type ApiMember } from "@/lib/api/members";
import { listPaymentMethods, PaymentMethod, PaymentProvider } from "@/lib/api/payments";
import {
  POS_PAYMENT_CHOICES,
  isEdc,
  usePosCheckout,
  type PosPaymentChoice,
} from "./use-pos-checkout";
import { PosReceiptModal } from "./pos-receipt-modal";

type Props = {
  items: CartItem[];
  customer: ApiMember;
  /** Active POS branch — decides which merchant a payment settles against. */
  branchId?: string;
  /** Active POS branch, stamped onto the payment note. */
  branchName?: string;
  onClose: () => void;
  /** Called once the transaction settled, so the POS can reset. */
  onCompleted: () => void;
  /**
   * Label of the button that ends the transaction. The till starts a new sale;
   * a drop-in taken during a class booking goes back to the booking instead.
   */
  completeLabel?: string;
  /** Reports whether a checkout is in flight, to lock the rest of the POS. */
  onBusyChange?: (busy: boolean) => void;
};

function StatusPill({ label, tone }: { label: string; tone: "wait" | "ok" | "bad" | "idle" }) {
  const classes = {
    wait: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    ok: "bg-green-500/10 text-green-600 border-green-500/30",
    bad: "bg-red-500/10 text-red-500 border-red-500/30",
    idle: "bg-muted/10 text-muted border-border",
  }[tone];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${classes}`}
    >
      {label}
    </span>
  );
}

/**
 * Checkout: pick a rail, then settle each payment on it.
 *
 * QRIS hands off to the backend's AsteriPay page and waits for the callback.
 * EDC takes the reference from the terminal slip. Neither path ever decides on
 * its own that a payment succeeded — the backend status does, and only a
 * backend-confirmed Paid can produce a receipt.
 */
export function PosCheckoutModal({
  items,
  customer,
  branchId,
  branchName,
  onClose,
  onCompleted,
  completeLabel = "Transaksi baru",
  onBusyChange,
}: Props) {
  const checkout = usePosCheckout(items, customer, branchName, branchId);
  const [selected, setSelected] = useState<PosPaymentChoice>("qris");
  const [notes, setNotes] = useState("");
  /** EDC slip reference per payment line — never carried between payments. */
  const [edcNumbers, setEdcNumbers] = useState<Record<string, string>>({});
  const [qrisAvailable, setQrisAvailable] = useState<boolean | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const { phase, steps, activeIndex, subtotal, paidPaymentIds } = checkout;
  const running = phase !== "idle";
  const finished = phase === "done";

  useEffect(() => {
    onBusyChange?.(running && !finished);
  }, [running, finished, onBusyChange]);

  // Surface whether the backend actually has QRIS enabled for AsteriPay.
  useEffect(() => {
    let cancelled = false;
    listPaymentMethods(PaymentProvider.AsteriPay).then((methods) => {
      if (cancelled) return;
      // An empty list means the endpoint is unavailable — do not block staff.
      if (methods.length === 0) return;
      setQrisAvailable(methods.some((m) => m.paymentMethod === PaymentMethod.QRIS));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) onClose();
      }}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 sm:p-6 border-b border-border flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold font-display uppercase text-fg">Pembayaran</h3>
            <p className="text-xs text-muted truncate mt-0.5">
              {memberDisplayName(customer)} · {items.length} item
              {branchName ? ` · ${branchName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={finished ? onCompleted : onClose}
            disabled={phase === "paying"}
            className="text-muted hover:text-fg text-xl leading-none disabled:opacity-30"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* ---------- Method selection ---------- */}
          {phase === "idle" && (
            <>
              <div className="bg-sidebar border border-border rounded-lg px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Total tagihan</span>
                  <span className="text-lg font-bold text-accent-ink font-display">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-muted text-xs uppercase font-bold mb-2">
                  Select payment method
                </p>
                <div className="space-y-2">
                  {POS_PAYMENT_CHOICES.map((c) => {
                    const unavailable = c.value === "qris" && qrisAvailable === false;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setSelected(c.value)}
                        disabled={unavailable}
                        className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          selected === c.value
                            ? "border-sweat bg-sweat/10"
                            : "border-border bg-sidebar hover:border-sweat/50"
                        }`}
                      >
                        <i className={`fas ${c.icon} text-accent-ink w-5`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-fg">{c.label}</span>
                          <span className="block text-[11px] text-muted">
                            {unavailable ? "Tidak aktif di payment method settings" : c.hint}
                          </span>
                        </span>
                        {selected === c.value && !unavailable && (
                          <i className="fas fa-check text-accent-ink" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-muted text-xs uppercase font-bold">Notes</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={`Opsional — default: Front Desk${branchName ? ` · ${branchName}` : ""} · <item>`}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-sweat"
                />
              </label>

              {checkout.error && (
                <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                  {checkout.error}
                </p>
              )}

              <button
                type="button"
                onClick={() => void checkout.start({ choice: selected, notes })}
                disabled={checkout.isBusy()}
                className="w-full bg-sweat text-black py-3 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-60"
              >
                Bayar {formatRupiah(subtotal)}
              </button>
            </>
          )}

          {/* ---------- Payment queue ---------- */}
          {steps.length > 0 && phase !== "idle" && (
            <div className="space-y-2">
              {steps.length > 1 && (
                <p className="text-[11px] text-muted uppercase tracking-wide">
                  Payment {Math.min(activeIndex + 1, steps.length)} dari {steps.length}
                </p>
              )}
              {steps.map((step, index) => {
                const tone =
                  step.status === "paid"
                    ? "ok"
                    : step.status === "failed"
                      ? "bad"
                      : index === activeIndex
                        ? "wait"
                        : "idle";
                return (
                  <div
                    key={step.lineId}
                    className={`rounded-lg border px-4 py-3 ${
                      index === activeIndex
                        ? "border-sweat/50 bg-sweat/5"
                        : "border-border bg-sidebar"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg truncate">{step.label}</p>
                        <p className="text-[11px] text-muted">
                          {formatRupiah(step.amount)}
                          {step.payment?.invoiceNo ? ` · ${step.payment.invoiceNo}` : ""}
                        </p>
                      </div>
                      <StatusPill
                        label={
                          step.status === "creating"
                            ? "Creating"
                            : step.status === "confirming"
                              ? "Confirming"
                              : (step.statusLabel ?? "Queued")
                        }
                        tone={tone}
                      />
                    </div>

                    {index === activeIndex && step.status === "awaiting" && (
                      <div className="mt-3 space-y-3">
                        {isEdc(checkout.choice) ? (
                          <>
                            <div className="bg-card border border-border rounded-lg px-3 py-2">
                              <p className="text-[11px] text-muted uppercase">Payment amount</p>
                              <p className="text-lg font-bold text-accent-ink font-display">
                                {formatRupiah(step.amount)}
                              </p>
                              <p className="text-[11px] text-muted mt-1">Method: EDC</p>
                            </div>
                            <label className="block">
                              <span className="text-muted text-xs uppercase font-bold">
                                EDC Transaction Number <span className="text-red-500">*</span>
                              </span>
                              <input
                                value={edcNumbers[step.lineId] ?? ""}
                                onChange={(e) =>
                                  setEdcNumbers((current) => ({
                                    ...current,
                                    [step.lineId]: e.target.value,
                                  }))
                                }
                                autoFocus
                                placeholder="mis. EDC-123456"
                                className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-fg font-mono focus:outline-none focus:border-sweat"
                              />
                              <span className="block text-[11px] text-muted mt-1">
                                Salin nomor referensi dari struk mesin EDC. Jangan pernah
                                memasukkan nomor kartu, CVV, PIN, atau masa berlaku.
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                void checkout.confirmEdc(edcNumbers[step.lineId] ?? "")
                              }
                              disabled={
                                !(edcNumbers[step.lineId] ?? "").trim() || checkout.isBusy()
                              }
                              className="w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Confirm Payment
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                              <p className="text-xs text-blue-500">
                                Waiting for QRIS payment… status dibaca dari backend.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={step.paymentUrl ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-1 text-center py-2.5 rounded-lg text-sm font-bold transition ${
                                  step.paymentUrl
                                    ? "bg-sweat text-black hover:brightness-95"
                                    : "bg-sidebar border border-border text-muted pointer-events-none"
                                }`}
                              >
                                <i className="fas fa-qrcode mr-2" aria-hidden />
                                {step.paymentUrl ? "Buka halaman QRIS" : "Menyiapkan QRIS..."}
                              </a>
                              <button
                                type="button"
                                onClick={() => void checkout.refreshActivePayment()}
                                className="px-3 bg-sidebar border border-border text-fg rounded-lg text-sm"
                                title="Cek status sekarang"
                              >
                                <i className="fas fa-sync" aria-hidden />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={checkout.cancelWaiting}
                              className="w-full bg-sidebar border border-border text-fg-soft py-2 rounded-lg text-xs"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {step.error && (
                      <p className="mt-2 text-xs text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                        {step.error}
                      </p>
                    )}

                    {/* Drop-in lines: did the backend actually issue the pass? */}
                    {step.dropInCheck === "checking" && (
                      <p className="mt-2 text-[11px] text-muted flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />
                        Memverifikasi penerbitan drop-in pass…
                      </p>
                    )}
                    {step.dropInCheck === "issued" && (
                      <p className="mt-2 text-[11px] text-green-600 bg-green-500/10 border border-green-500/30 px-3 py-2 rounded">
                        <i className="fas fa-check mr-1.5" aria-hidden />
                        Drop-in pass terbit di akun member.
                      </p>
                    )}
                    {step.dropInCheck === "missing" && (
                      <p className="mt-2 text-[11px] text-yellow-600 bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded">
                        <i className="fas fa-triangle-exclamation mr-1.5" aria-hidden />
                        Pembayaran sudah Paid, tapi drop-in pass belum terlihat di akun
                        member. Jangan ulangi pembayaran — cek menu Drop In dulu, pass
                        bisa menyusul beberapa saat.
                      </p>
                    )}
                    {step.dropInCheck === "skipped" && (
                      <p className="mt-2 text-[11px] text-muted">
                        Drop-in pass tidak bisa diverifikasi otomatis — cek menu Drop In.
                      </p>
                    )}

                    {index === activeIndex && step.status === "failed" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void checkout.retryActiveStep()}
                          className="flex-1 bg-sidebar border border-border text-fg py-2 rounded-lg text-xs"
                        >
                          <i className="fas fa-redo mr-2" aria-hidden />
                          {step.payment ? "Cek ulang status" : "Coba lagi"}
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          className="flex-1 bg-sidebar border border-border text-fg-soft py-2 rounded-lg text-xs"
                        >
                          Tutup
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------- Done ---------- */}
          {finished && (
            <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
              <p className="font-bold text-sm text-green-600">✓ Payment Successful</p>
              <p className="text-xs text-muted mt-1">
                Semua payment sudah dikonfirmasi backend.
              </p>
              {steps.some((s) => s.dropInCheck === "missing") && (
                <p className="text-[11px] text-yellow-700 mt-2">
                  Ada drop-in pass yang belum terverifikasi terbit — buka menu Drop In
                  untuk memastikan sebelum customer pergi.
                </p>
              )}

              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                disabled={paidPaymentIds.length === 0}
                className="mt-3 w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-print mr-2" aria-hidden />
                Receipt · print / email
              </button>

              <button
                type="button"
                onClick={onCompleted}
                className="mt-2 w-full bg-sidebar border border-border text-fg py-2.5 rounded-lg text-sm font-bold"
              >
                {completeLabel}
              </button>
            </div>
          )}
        </div>
      </div>

      {receiptOpen && (
        <PosReceiptModal
          paymentIds={paidPaymentIds}
          orderRef={checkout.orderRef}
          defaultEmail={customer.email}
          onClose={() => setReceiptOpen(false)}
        />
      )}
    </div>
  );
}
