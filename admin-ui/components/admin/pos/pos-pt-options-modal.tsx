"use client";

import { useEffect, useState } from "react";

import { branchLabel, listBranches, type Branch } from "@/lib/api/branches";
import {
  formatRupiah,
  newLineId,
  ptTrainingTypeLabel,
  type PtCartItem,
} from "@/lib/pos/cart";
import type { PtPackage } from "@/lib/api/pt-packages";

type Props = {
  pkg: PtPackage;
  onClose: () => void;
  onAdd: (item: PtCartItem) => void;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-200 text-right">{value}</span>
    </div>
  );
}

/**
 * Branch selection for a PT package before it enters the cart.
 *
 * `PurchasePTPackageAsync` takes only the member, the package, the branch and
 * the payment method — price, session count and coach all come from the package
 * record — so this screen chooses the branch and shows the rest read-only
 * rather than offering controls the purchase cannot carry.
 */
export function PosPtOptionsModal({ pkg, onClose, onAdd }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState(pkg.branchId ?? "");

  useEffect(() => {
    let cancelled = false;
    listBranches()
      .then((list) => {
        if (cancelled) return;
        setBranches(list);
        // Keep a package's own branch only when it is still a valid choice.
        setBranchId((current) =>
          current && list.some((b) => b.id === current) ? current : ""
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function add() {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    onAdd({
      lineId: newLineId(),
      kind: "pt",
      name: pkg.name,
      price: pkg.price ?? 0,
      pkg,
      sessionCount: pkg.sessionCount ?? 0,
      branchId,
      branchName: branchLabel(branch),
      coachName: pkg.coachName ?? "",
      trainingTypeLabel: ptTrainingTypeLabel(pkg),
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold font-display uppercase text-white truncate">
              {pkg.name}
            </h3>
            <p className="text-xs text-sweat mt-0.5">{ptTrainingTypeLabel(pkg)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="bg-sidebar rounded-lg border border-border px-3 py-1 mb-4">
          <Detail label="Sessions" value={`${pkg.sessionCount ?? 0} sesi`} />
          <Detail label="Price" value={formatRupiah(pkg.price ?? 0)} />
          <Detail label="Coach" value={pkg.coachName || "Ditentukan saat sesi dibuat"} />
        </div>

        {pkg.description && (
          <p className="text-xs text-gray-400 bg-sidebar border border-border rounded-lg px-3 py-2 mb-4 whitespace-pre-wrap">
            {pkg.description}
          </p>
        )}

        <label className="block">
          <span className="text-gray-500 text-xs uppercase font-bold">
            Branch <span className="text-red-400">*</span>
          </span>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={loading}
            className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat disabled:opacity-50"
          >
            <option value="">{loading ? "Memuat branch..." : "Pilih branch"}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchLabel(b)}
              </option>
            ))}
          </select>
          <span className="block text-[11px] text-gray-600 mt-1">
            Wajib — pembelian PT package ditolak backend tanpa branch.
          </span>
        </label>

        <button
          type="button"
          onClick={add}
          disabled={!branchId}
          className="mt-4 w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add to cart · {formatRupiah(pkg.price ?? 0)}
        </button>
      </div>
    </div>
  );
}
