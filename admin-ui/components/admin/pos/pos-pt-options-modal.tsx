"use client";

import { formatRupiah, newLineId, type PtCartItem } from "@/lib/pos/cart";
import type { PtPackage } from "@/lib/api/pt-packages";

type Props = {
  pkg: PtPackage;
  /** Active POS branch — the purchase is always made against it. */
  branchId: string;
  branchName: string;
  /** True when this package was already assigned to the selected customer. */
  assignedToMember?: boolean;
  onClose: () => void;
  onAdd: (item: PtCartItem) => void;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-fg-soft text-right">{value}</span>
    </div>
  );
}

/**
 * Confirmation step for a PT package before it enters the transaction.
 *
 * `PurchasePTPackageAsync` takes only the member, the package, the branch and
 * the payment method — price, session count and coach all come from the package
 * record. The branch is no longer asked for here: the POS is already operating
 * as one branch, and letting this screen disagree with the branch selector was
 * a way to settle against the wrong AsteriPay merchant.
 */
export function PosPtOptionsModal({
  pkg,
  branchId,
  branchName,
  assignedToMember = false,
  onClose,
  onAdd,
}: Props) {
  function add() {
    if (!branchId) return;
    onAdd({
      lineId: newLineId(),
      kind: "pt",
      name: pkg.name,
      price: pkg.price ?? 0,
      pkg,
      sessionCount: pkg.sessionCount ?? 0,
      branchId,
      branchName,
      coachName: pkg.coachName ?? "",
      assignedToMember,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold font-display uppercase text-fg truncate">
              {pkg.name}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {pkg.sessionCount ?? 0} sesi · {formatRupiah(pkg.price ?? 0)}
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

        {assignedToMember && (
          <p className="text-[11px] text-fg-soft bg-sweat/10 border border-sweat/30 rounded-lg px-3 py-2 mb-4">
            Package ini sudah di-assign ke customer yang dipilih, jadi bisa langsung
            ditagihkan di sini.
          </p>
        )}

        <div className="bg-sidebar rounded-lg border border-border px-3 py-1 mb-4">
          <Detail label="Sessions" value={`${pkg.sessionCount ?? 0} sesi`} />
          <Detail label="Price" value={formatRupiah(pkg.price ?? 0)} />
          <Detail label="Coach" value={pkg.coachName || "Ditentukan saat sesi dibuat"} />
          <Detail label="Branch" value={branchName || "-"} />
        </div>

        {pkg.description && (
          <p className="text-xs text-fg-soft bg-sidebar border border-border rounded-lg px-3 py-2 mb-4 whitespace-pre-wrap">
            {pkg.description}
          </p>
        )}

        {!branchId && (
          <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded mb-3">
            Branch belum dipilih di POS — pembelian PT package ditolak backend tanpa branch.
          </p>
        )}

        <button
          type="button"
          onClick={add}
          disabled={!branchId}
          className="w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tambah ke transaksi · {formatRupiah(pkg.price ?? 0)}
        </button>
      </div>
    </div>
  );
}
