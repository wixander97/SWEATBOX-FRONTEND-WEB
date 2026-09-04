import type { MembershipPlan } from "@/lib/api/membership-plans";
import type { PtPackage } from "@/lib/api/pt-packages";
import type { ApiClass } from "@/lib/api/classes";

/**
 * POS cart model.
 *
 * A cart line is a *pending intent*; nothing is persisted until checkout, where
 * each priced line becomes a real backend payment and each free line (class
 * booking) is executed through its own existing endpoint.
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
};

export type ClassBookingCartItem = {
  lineId: string;
  kind: "class";
  name: string;
  /** Class bookings are settled with membership credits, not money. */
  price: 0;
  schedule: ApiClass;
};

export type CartItem = MembershipCartItem | PtCartItem | ClassBookingCartItem;

/** Cart lines that produce a backend payment. */
export type PayableCartItem = MembershipCartItem | PtCartItem;

export const CART_KIND_LABEL: Record<CartItem["kind"], string> = {
  membership: "Membership",
  pt: "PT Package",
  class: "Class Booking",
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
export function payableItems(items: CartItem[]): PayableCartItem[] {
  return items.filter(
    (item): item is PayableCartItem => item.kind !== "class" && item.price > 0
  );
}

export function bookingItems(items: CartItem[]): ClassBookingCartItem[] {
  return items.filter((item): item is ClassBookingCartItem => item.kind === "class");
}

/** Guard against booking the same class twice in one transaction. */
export function hasClass(items: CartItem[], classScheduleId: string): boolean {
  return items.some((item) => item.kind === "class" && item.schedule.id === classScheduleId);
}

export function formatRupiah(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "Rp 0";
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}
