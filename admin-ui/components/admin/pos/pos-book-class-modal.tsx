"use client";

import { useCallback, useMemo, useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import { bookedCountOf, createClassBooking, remainingSlotsOf, type ApiClass } from "@/lib/api/classes";
import {
  dropInOptionSubtitle,
  loadDropInOptions,
  type DropInOption,
  type DropInOptionsResult,
} from "@/lib/api/drop-in-options";
import { memberDisplayName, type ApiMember } from "@/lib/api/members";
import { dropInCartItem, formatRupiah } from "@/lib/pos/cart";
import { PosCheckoutModal } from "./pos-checkout-modal";

type Props = {
  schedule: ApiClass;
  customer: ApiMember;
  /** Classes the member already has booked, to catch a duplicate before the call. */
  alreadyBookedScheduleIds: string[];
  /** Till's branch — the drop-in offered here is sold on it. */
  branchId: string;
  branchName: string;
  onClose: () => void;
  /** Fired after a booking lands, so the customer panel can refresh. */
  onBooked: (schedule: ApiClass) => void;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-fg-soft text-right">{value}</span>
    </div>
  );
}

/**
 * Whether a refused booking is about entitlement rather than about the class.
 *
 * `ClassBookingService` refuses for two very different reasons: the customer
 * has nothing to pay with (no active membership, no credits left, no valid
 * drop-in pass), or the class itself cannot take them (full, cancelled,
 * already started). Only the first is something money fixes, so only the first
 * opens the drop-in offer — a full class must never be answered with "buy a
 * drop-in".
 *
 * Matched on the backend's own wording, in both languages it answers in.
 */
function isEntitlementProblem(message: string): boolean {
  const text = message.toLowerCase();
  const blockers = [
    "penuh",
    "full",
    "capacity",
    "kapasitas",
    "dibatalkan",
    "cancel",
    "sudah dimulai",
    "started",
    "sudah booking",
    "already booked",
  ];
  if (blockers.some((word) => text.includes(word))) return false;

  const entitlement = [
    "membership",
    "member tidak",
    "credit",
    "kredit",
    "kuota",
    "drop-in",
    "drop in",
    "dropin",
    "pass",
    "expired",
    "kadaluarsa",
    "berakhir",
    "tidak aktif",
    "not active",
    "belum aktif",
    "belum bayar",
    "unpaid",
    "tidak memiliki",
    "no active",
    "not eligible",
    "tidak berhak",
  ];
  return entitlement.some((word) => text.includes(word));
}

/**
 * Book a class for the customer at the counter.
 *
 * The booking itself posts straight to `POST /api/v1/class-bookings` — the same
 * endpoint the member app books through — so the booking shows up in the
 * member's app immediately and there is no second booking implementation to
 * keep in step. Every eligibility rule (active and paid membership, credits or
 * an unlimited plan, a plan that allows classes at all, capacity, drop-in pass
 * for another branch) stays with `ClassBookingService`; this modal shows the
 * backend's own message rather than re-deciding any of it.
 *
 * What it adds is the walk-in path, and it is why drop-ins are no longer a
 * shelf in the catalogue: when the refusal is about entitlement — no membership,
 * no credits, no valid drop-in pass — the front desk is offered the drop-in
 * tiers configured in System Settings (single visit, multi-visit pass), takes
 * the payment on the usual QRIS/EDC rails, and the booking is retried the
 * moment the backend reports the payment Paid. Same shape as the member app:
 * try to book, pay for a drop-in, get booked.
 */
export function PosBookClassModal({
  schedule,
  customer,
  alreadyBookedScheduleIds,
  branchId,
  branchName,
  onClose,
  onBooked,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /** Drop-in tiers, loaded only once a sale is actually on the table. */
  const [offer, setOffer] = useState<DropInOptionsResult | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  /** The tier being paid for right now, if any. */
  const [paying, setPaying] = useState<DropInOption | null>(null);
  /** True once a drop-in for this booking has been settled. */
  const [dropInPaid, setDropInPaid] = useState(false);

  const duplicate = alreadyBookedScheduleIds.includes(schedule.id);

  const openOffer = useCallback(async () => {
    if (offerLoading) return;
    setOfferLoading(true);
    try {
      setOffer(await loadDropInOptions(branchId));
    } finally {
      setOfferLoading(false);
    }
  }, [branchId, offerLoading]);

  const book = useCallback(
    async (afterDropIn = false) => {
      if (busy || duplicate) return;
      setBusy(true);
      setError("");
      try {
        await createClassBooking({
          memberId: customer.id,
          classScheduleId: schedule.id,
        });
        setDone(true);
        setOffer(null);
        onBooked(schedule);
      } catch (err) {
        const message = errorMessageOf(err, "Gagal membooking class");
        setError(message);
        // The customer has nothing to book with: offer what they can buy.
        // After a drop-in has already been paid for, a second refusal is not
        // answered with a second sale — the front desk reads the message.
        if (!afterDropIn && !dropInPaid && isEntitlementProblem(message)) {
          void openOffer();
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, duplicate, customer.id, schedule, onBooked, dropInPaid, openOffer]
  );

  /** The drop-in settled; the class is booked on the strength of it. */
  const afterDropInPaid = useCallback(() => {
    setPaying(null);
    setOffer(null);
    setDropInPaid(true);
    void book(true);
  }, [book]);

  const options = offer?.options ?? [];

  /*
   * The one line the drop-in sale consists of, built once per selected tier.
   * Rebuilding it on every render would hand the checkout a new `lineId` each
   * time and detach the payment steps it keys by that id.
   */
  const dropInItems = useMemo(() => (paying ? [dropInCartItem(paying)] : []), [paying]);

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && !paying) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold font-display uppercase text-fg truncate">
              Book Class
            </h3>
            <p className="text-xs text-muted mt-0.5 truncate">
              {memberDisplayName(customer)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy || !!paying}
            className="text-muted hover:text-fg text-xl leading-none disabled:opacity-30"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="bg-sidebar rounded-lg border border-border px-3 py-1 mb-4">
          <Detail label="Class" value={schedule.className} />
          <Detail label="Tanggal" value={formatDate(schedule.classDate)} />
          <Detail
            label="Jam"
            value={`${schedule.startTime?.slice(0, 5) ?? "-"} – ${schedule.endTime?.slice(0, 5) ?? "-"}`}
          />
          <Detail label="Coach" value={schedule.coachName ?? "-"} />
          <Detail label="Branch" value={schedule.branchName ?? "-"} />
          <Detail
            label="Slot"
            value={`${bookedCountOf(schedule)} / ${schedule.capacity ?? 0} terisi · ${remainingSlotsOf(schedule)} sisa`}
          />
        </div>

        {done ? (
          <>
            <p className="text-sm text-green-500 bg-green-500/10 border border-green-500/30 px-3 py-2.5 rounded">
              ✓ Class berhasil dibooking. Booking langsung muncul di aplikasi member.
              {dropInPaid ? " Drop-in sudah dibayar dan tercatat di Payments." : ""}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-95 transition"
            >
              Selesai
            </button>
          </>
        ) : (
          <>
            {duplicate && (
              <p className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded mb-3">
                Member ini sudah punya booking untuk class tersebut.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded mb-3">
                {error}
              </p>
            )}

            {dropInPaid && !done && (
              <p className="text-xs text-yellow-600 bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded mb-3">
                Drop-in sudah dibayar. Kalau booking masih ditolak, jangan bayar
                lagi — cek pass-nya di menu Drop In lalu ulangi booking.
              </p>
            )}

            {offerLoading && (
              <p className="text-xs text-muted flex items-center gap-2 mb-3">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />
                Memuat opsi drop-in…
              </p>
            )}

            {offer && !offerLoading && (
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                  Bayar drop-in
                </p>
                <p className="text-[11px] text-muted mb-2">
                  Member ini belum punya entitlement yang berlaku. Pilih drop-in,
                  bayar sekarang, dan class otomatis dibooking setelah pembayaran
                  dikonfirmasi backend.
                </p>

                {offer.warning && (
                  <p className="text-[11px] text-yellow-600 bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded mb-2">
                    {offer.warning}
                  </p>
                )}

                {options.length === 0 ? (
                  <p className="text-xs text-muted bg-sidebar border border-border px-3 py-2 rounded">
                    Belum ada opsi drop-in yang bisa dijual di branch ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPaying(option)}
                        className="w-full flex items-center gap-3 rounded-lg border border-border bg-sidebar hover:border-sweat px-4 py-3 text-left transition"
                      >
                        <i
                          className={`fas ${option.kind === "pass" ? "fa-ticket-alt" : "fa-door-open"} text-accent-ink w-5`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-fg truncate">
                            {option.label}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {dropInOptionSubtitle(option)}
                          </span>
                        </span>
                        <span className="text-sm font-bold text-accent-ink shrink-0">
                          {formatRupiah(option.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-muted mt-2">
                  Sumber harga:{" "}
                  {offer.source === "settings"
                    ? "System Settings"
                    : offer.source === "plan"
                      ? "membership plan kategori Drop In"
                      : "belum dikonfigurasi"}
                  .
                </p>
              </div>
            )}

            {!offer && (
              <p className="text-[11px] text-muted mb-3">
                Class dipotong dari entitlement membership yang berlaku. Kalau
                member belum punya, POS akan menawarkan drop-in setelah backend
                menolak booking.
              </p>
            )}

            <button
              type="button"
              onClick={() => void book()}
              disabled={busy || duplicate}
              className="w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Membooking…" : error ? "Coba book lagi" : "Book Class"}
            </button>

            {/* Escape hatch: sell a drop-in even when the refusal was worded in
                a way this screen did not recognise. */}
            {!offer && error && !offerLoading && (
              <button
                type="button"
                onClick={() => void openOffer()}
                className="mt-2 w-full bg-sidebar border border-border text-fg-soft py-2 rounded-lg text-xs font-bold"
              >
                Jual drop-in untuk member ini
              </button>
            )}
          </>
        )}
      </div>

      {paying && (
        <PosCheckoutModal
          items={dropInItems}
          customer={customer}
          branchId={branchId}
          branchName={branchName}
          completeLabel="Lanjut book class"
          onClose={() => setPaying(null)}
          onCompleted={afterDropInPaid}
        />
      )}
    </div>
  );
}
