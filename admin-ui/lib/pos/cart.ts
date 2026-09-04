import type { MembershipPlan } from "@/lib/api/membership-plans";
import type { PtPackage } from "@/lib/api/pt-packages";

/**
 * POS cart model.
 *
 * A cart line is a *pending intent*; nothing is persisted until checkout, where
 * each line becomes a real backend payment.
 *
 * The cart holds only what money is taken for — memberships and PT packages.
 * Classes are deliberately not sellable lines: a class is settled with the
 * member's own entitlement, not with a payment, so it is booked directly
 * through `POST /api/v1/class-bookings` (see `PosBookClassModal`) rather than
 * being queued behind a checkout it would never take money for.
 */

export type MembershipCartItem = {
  lineId: string;
  kind: "membership";
  name: string;
  price: number;
  plan: MembershipPlan;
};

export type PtCartItem = {
  lineId: string;
  kind: "pt";
  name: string;
  price: number;
  pkg: PtPackage;
  sessionCount: number;
  /**
   * Required by `PurchasePTPackageAsync`, which throws when the branch does not
   * resolve. Everything else — price, sessions, coach — comes from the package.
   */
  branchId: string;
  branchName: string;
  /** Display only, read off the package record. */
  coachName: string;
  /**
   * True when this package was already assigned to the customer in Admin, as
   * opposed to being taken from the open catalogue. The backend accepts both
   * from the same endpoint; this only drives the label.
   */
  assignedToMember?: boolean;
};

export type CartItem = MembershipCartItem | PtCartItem;

export const CART_KIND_LABEL: Record<CartItem["kind"], string> = {
  membership: "Membership",
  pt: "PT Package",
};

export function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.price || 0), 0);
}

/** Lines that need money to change hands, in checkout order. */
export function payableItems(items: CartItem[]): CartItem[] {
  return items.filter((item) => item.price > 0);
}

/** Guard against queueing the same PT package twice in one transaction. */
export function hasPackage(items: CartItem[], packageId: string): boolean {
  return items.some((item) => item.kind === "pt" && item.pkg.id === packageId);
}

export function formatRupiah(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "Rp 0";
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}
