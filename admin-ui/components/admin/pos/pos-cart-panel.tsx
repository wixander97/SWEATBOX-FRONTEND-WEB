"use client";

import {
  CART_KIND_LABEL,
  cartSubtotal,
  formatRupiah,
  payableItems,
  type CartItem,
} from "@/lib/pos/cart";

type Props = {
  items: CartItem[];
  onRemove: (lineId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  hasCustomer: boolean;
  disabled?: boolean;
};

function lineDetail(item: CartItem): string {
  switch (item.kind) {
    case "membership":
      return `${item.plan.validityDays} hari · ${
        item.plan.isUnlimitedClasses ? "Unlimited class" : `${item.plan.credits} credit`
      }`;
    case "pt":
      return [
        item.trainingTypeLabel,
        `${item.sessionCount} sesi`,
        item.branchName,
        item.coachName ? `Coach ${item.coachName}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "class": {
      const date = item.schedule.classDate
        ? new Date(item.schedule.classDate).toLocaleDateString("id-ID")
        : "-";
      return `${date} ${item.schedule.startTime?.slice(0, 5) ?? ""} · ${
        item.schedule.coachName ?? "-"
      }`;
    }
  }
}

/** Cart, totals and the checkout entry point. */
export function PosCartPanel({
  items,
  onRemove,
  onClear,
  onCheckout,
  hasCustomer,
  disabled = false,
}: Props) {
  const subtotal = cartSubtotal(items);
  const payable = payableItems(items);
  const freeCount = items.length - payable.length;

  const blockedReason = !hasCustomer
    ? "Pilih customer dulu"
    : items.length === 0
      ? "Cart masih kosong"
      : null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Cart {items.length > 0 && `(${items.length})`}
        </p>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[11px] text-gray-500 hover:text-red-400 disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 min-h-0">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-shopping-cart text-2xl text-gray-700 mb-2 block" aria-hidden />
            <p className="text-xs text-gray-600">
              Pilih membership, PT package, atau class dari katalog.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.lineId} className="py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-sweat font-bold">
                    {CART_KIND_LABEL[item.kind]}
                  </p>
                  <p className="text-sm text-white font-semibold truncate">{item.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{lineDetail(item)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-white font-semibold">
                    {item.price > 0 ? formatRupiah(item.price) : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(item.lineId)}
                    disabled={disabled}
                    className="text-gray-600 hover:text-red-400 text-xs mt-1 disabled:opacity-40"
                    aria-label={`Remove ${item.name}`}
                  >
                    <i className="fas fa-trash" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-4 space-y-2 bg-sidebar/40">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-gray-200">{formatRupiah(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Discount</span>
          <span
            className="text-gray-400"
            title="Harga PT package diambil apa adanya dari package record — backend tidak menerapkan diskon"
          >
            {formatRupiah(0)}
          </span>
        </div>
        {freeCount > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Class booking</span>
            <span className="text-gray-400">
              {freeCount} booking · pakai credit member
            </span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-2 border-t border-border">
          <span className="text-sm font-bold uppercase text-gray-300">Total</span>
          <span className="text-xl font-bold text-sweat font-display">
            {formatRupiah(subtotal)}
          </span>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          disabled={disabled || !!blockedReason}
          className="w-full bg-sweat text-black py-3 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <i className="fas fa-cash-register" aria-hidden />
          {blockedReason ?? `Checkout · ${formatRupiah(subtotal)}`}
        </button>
      </div>
    </div>
  );
}
