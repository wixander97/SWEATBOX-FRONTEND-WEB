"use client";

import { useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import { bookedCountOf, createClassBooking, remainingSlotsOf, type ApiClass } from "@/lib/api/classes";
import { memberDisplayName, type ApiMember } from "@/lib/api/members";

type Props = {
  schedule: ApiClass;
  customer: ApiMember;
  /** Classes the member already has booked, to catch a duplicate before the call. */
  alreadyBookedScheduleIds: string[];
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
 * Book a class for the customer at the counter.
 *
 * A class is not a sale: it is settled with the member's own entitlement, so it
 * never enters the cart and never reaches checkout. This posts straight to
 * `POST /api/v1/class-bookings` — the same endpoint the member app books
 * through — which is why the booking shows up in the member's app immediately
 * and why there is no second booking implementation to keep in step.
 *
 * Every eligibility rule (active and paid membership, not expired, credits or
 * an unlimited plan, a plan that allows classes at all, capacity, drop-in pass
 * for another branch) is enforced by `ClassBookingService`. The front desk
 * shows the backend's own message rather than re-deciding any of it here.
 */
export function PosBookClassModal({
  schedule,
  customer,
  alreadyBookedScheduleIds,
  onClose,
  onBooked,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const duplicate = alreadyBookedScheduleIds.includes(schedule.id);

  async function book() {
    if (busy || duplicate) return;
    setBusy(true);
    setError("");
    try {
      await createClassBooking({
        memberId: customer.id,
        classScheduleId: schedule.id,
      });
      setDone(true);
      onBooked(schedule);
    } catch (err) {
      setError(errorMessageOf(err, "Gagal membooking class"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
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
            disabled={busy}
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

            <p className="text-[11px] text-muted mb-3">
              Class tidak melalui pembayaran — dipotong dari entitlement membership
              yang berlaku. Kelayakan divalidasi backend.
            </p>

            <button
              type="button"
              onClick={() => void book()}
              disabled={busy || duplicate}
              className="w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Membooking…" : "Book Class"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
