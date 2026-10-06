import type { DropInProduct } from "@/lib/api/drop-in";
import type { CartItem } from "./cart";

/**
 * What the backend says one cart line will be charged.
 *
 * Every number here comes from the backend's own pricing — the quote endpoint
 * for a membership or PT package, the member-priced product list for a
 * drop-in. Nothing is decided here about who is eligible for which discount.
 */
export type LineQuote = {
  price: number;
  memberDiscount: number;
  firstTransactionDiscount: number;
  finalPrice: number;
};

export type CartSummaryLine = {
  lineId: string;
  /** Backend list price, or the cart price when no quote is available. */
  subtotal: number;
  memberDiscount: number;
  firstTransactionDiscount: number;
  total: number;
  quoted: boolean;
};

export type CartSummary = {
  lines: CartSummaryLine[];
  subtotal: number;
  memberDiscount: number;
  firstTransactionDiscount: number;
  /** Member discount plus first transaction discount. */
  discount: number;
  total: number;
  /** False when at least one line fell back to its cart price. */
  complete: boolean;
};

/** A drop-in product, priced for the member, as a line quote. */
export function dropInLineQuote(product: DropInProduct): LineQuote {
  const firstTransactionDiscount = product.firstTransactionDiscount ?? 0;
  return {
    price: product.price,
    memberDiscount: Math.max(0, (product.discount ?? 0) - firstTransactionDiscount),
    firstTransactionDiscount,
    finalPrice: product.finalPrice,
  };
}

/**
 * Subtotal, discount and total for the cart, from backend quotes.
 *
 * Each line is quoted on its own, so for an eligible customer every line comes
 * back carrying the first transaction discount. The customer only gets it once:
 * the POS settles payments one after another, and the backend spends the
 * discount when the first discounted payment is Paid, so it prices every later
 * payment without it. The summary therefore keeps the discount on the first
 * line (in checkout order) that the backend quoted it for and adds it back on
 * the rest. Which line qualifies is still entirely the backend's answer.
 *
 * A line without a quote (the request failed or is still loading) is counted
 * at its cart price and marks the summary incomplete.
 */
export function summarizeCart(
  items: CartItem[],
  quotes: Readonly<Record<string, LineQuote | undefined>>
): CartSummary {
  let firstTransactionTaken = false;

  const lines = items.map((item): CartSummaryLine => {
    const quote = quotes[item.lineId];
    if (!quote) {
      return {
        lineId: item.lineId,
        subtotal: item.price,
        memberDiscount: 0,
        firstTransactionDiscount: 0,
        total: item.price,
        quoted: false,
      };
    }

    let firstTransactionDiscount = Math.max(0, quote.firstTransactionDiscount);
    let total = quote.finalPrice;
    if (firstTransactionDiscount > 0) {
      if (firstTransactionTaken) {
        total += firstTransactionDiscount;
        firstTransactionDiscount = 0;
      } else {
        firstTransactionTaken = true;
      }
    }

    return {
      lineId: item.lineId,
      subtotal: quote.price,
      memberDiscount: Math.max(0, quote.memberDiscount),
      firstTransactionDiscount,
      total,
      quoted: true,
    };
  });

  return totals(lines);
}

/** The pricing fields of a backend payment (`PaymentResponseDto`). */
export type PricedPayment = {
  amount?: number;
  discount?: number;
  firstTransactionDiscount?: number;
  finalAmount?: number;
};

function totals(lines: CartSummaryLine[]): CartSummary {
  const sum = (pick: (line: CartSummaryLine) => number) =>
    lines.reduce((acc, line) => acc + pick(line), 0);
  const memberDiscount = sum((l) => l.memberDiscount);
  const firstTransactionDiscount = sum((l) => l.firstTransactionDiscount);
  return {
    lines,
    subtotal: sum((l) => l.subtotal),
    memberDiscount,
    firstTransactionDiscount,
    discount: memberDiscount + firstTransactionDiscount,
    total: sum((l) => l.total),
    complete: lines.every((l) => l.quoted),
  };
}

/**
 * The summary once some of its payments exist.
 *
 * A created payment's own figures replace the line's quote: `finalAmount` is
 * what the backend will settle, whatever was quoted a moment earlier. Lines
 * still queued keep their quote.
 */
export function applyPayments(
  summary: CartSummary,
  payments: Readonly<Record<string, PricedPayment | null | undefined>>
): CartSummary {
  return totals(
    summary.lines.map((line) => {
      const payment = payments[line.lineId];
      if (!payment || payment.finalAmount == null) return line;
      const discount = payment.discount ?? 0;
      const firstTransactionDiscount = payment.firstTransactionDiscount ?? 0;
      return {
        lineId: line.lineId,
        subtotal: payment.amount ?? payment.finalAmount + discount,
        memberDiscount: Math.max(0, discount - firstTransactionDiscount),
        firstTransactionDiscount,
        total: payment.finalAmount,
        quoted: true,
      };
    })
  );
}

export type PriceSummaryRow = {
  key: "subtotal" | "discount" | "member-discount" | "first-transaction" | "total";
  label: string;
  amount: number;
  /** Shown as "-Rp …". */
  negative?: boolean;
  /** Breakdown of the discount row, rendered indented. */
  detail?: boolean;
};

/**
 * Subtotal / Discount / Total, with the discount broken down when there is
 * one. The Discount row is always present, so a customer who is not eligible
 * plainly sees Rp 0 rather than a missing line.
 */
export function priceSummaryRows(summary: CartSummary): PriceSummaryRow[] {
  const rows: PriceSummaryRow[] = [
    { key: "subtotal", label: "Subtotal", amount: summary.subtotal },
    { key: "discount", label: "Discount", amount: summary.discount, negative: summary.discount > 0 },
  ];
  if (summary.memberDiscount > 0) {
    rows.push({
      key: "member-discount",
      label: "Member discount",
      amount: summary.memberDiscount,
      negative: true,
      detail: true,
    });
  }
  if (summary.firstTransactionDiscount > 0) {
    rows.push({
      key: "first-transaction",
      label: "First transaction discount",
      amount: summary.firstTransactionDiscount,
      negative: true,
      detail: true,
    });
  }
  rows.push({ key: "total", label: "Total", amount: summary.total });
  return rows;
}
