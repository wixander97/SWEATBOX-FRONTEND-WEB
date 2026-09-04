"use client";

import {
  CART_KIND_LABEL,
  cartSubtotal,
  formatRupiah,
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
      return `${item.plan.validityDays} days · ${
        (item.plan.planCategory ?? "").toLowerCase() === "regular"
          ? "Gym access"
          : item.plan.isUnlimitedClasses
            ? "Unlimited class"
            : `${item.plan.credits} credit`
      }`;
    case "dropin":
      return [
        item.dropInKind === "pass" ? `${item.visits}x visits` : "1x visit",
        item.validityDays ? `valid for ${item.validityDays} days` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "pt":
      return [
        `${item.sessionCount} sessions`,
        item.branchName,
        item.coachName ? `Coach ${item.coachName}` : null,
        item.assignedToMember ? "Assigned" : null,
      ]
        .filter(Boolean)
        .join(" · ");
  }
}

/**
 * The current transaction, totals and the checkout entry point.
 *
 * Only priced lines live here. Class bookings are settled with the member's own
 * entitlement, so they are booked from the catalogue and never queued for
 * payment.
 */
export function PosCartPanel({
  items,
  onRemove,
  onClear,
  onCheckout,
  hasCustomer,
  disabled = false,
}: Props) {
  const subtotal = cartSubtotal(items);

  const blockedReason = !hasCustomer
    ? "Select a customer first"
    : items.length === 0
      ? "No items yet"
      : null;

  return (
    <div data-help-target="pos-cart" className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Transaction {items.length > 0 && `(${items.length})`}
        </p>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[11px] text-muted hover:text-red-500 disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 min-h-0">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-receipt text-2xl text-muted mb-2 block" aria-hidden />
            <p className="text-xs text-muted">
              Select a membership, drop in, or PT package from the catalog. Classes are
              booked directly without payment.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.lineId} className="py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-accent-ink font-bold">
                    {CART_KIND_LABEL[item.kind]}
                  </p>
                  <p className="text-sm text-fg font-semibold truncate">{item.name}</p>
                  <p className="text-[11px] text-muted truncate">{lineDetail(item)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-fg font-semibold">
                    {formatRupiah(item.price)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(item.lineId)}
                    disabled={disabled}
                    className="text-muted hover:text-red-500 text-xs mt-1 disabled:opacity-40"
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

      <div className="border-t border-border p-4 space-y-2 bg-sidebar">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="text-fg-soft">{formatRupiah(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Discount</span>
          <span
            className="text-fg-soft"
            title="Prices are taken as-is from the plan/package record — the backend applies no discount"
          >
            {formatRupiah(0)}
          </span>
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-border">
          <span className="text-sm font-bold uppercase text-fg-soft">Total</span>
          <span className="text-xl font-bold text-accent-ink font-display">
            {formatRupiah(subtotal)}
          </span>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          data-help-target="pos-checkout"
          disabled={disabled || !!blockedReason}
          className="w-full bg-sweat text-black py-3 rounded-lg text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <i className="fas fa-cash-register" aria-hidden />
          {blockedReason ?? `Pay · ${formatRupiah(subtotal)}`}
        </button>
      </div>
    </div>
  );
}
