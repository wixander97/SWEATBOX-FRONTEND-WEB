// POS checkout pricing: the till must show and charge what the backend prices,
// including the first transaction discount.
//
// Run with `npm test` (Node's built-in runner, TypeScript stripped natively).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPayments,
  dropInLineQuote,
  priceSummaryRows,
  summarizeCart,
} from "../lib/pos/pricing.ts";

const membership = (lineId, price) => ({ lineId, kind: "membership", name: "Membership", price });
const pt = (lineId, price) => ({ lineId, kind: "pt", name: "PT Package", price });
const dropIn = (lineId, price) => ({ lineId, kind: "dropin", name: "Single Visit", price });

/** `PurchaseQuoteResponse` as the backend returns it. */
const quote = ({ price, memberDiscount = 0, firstTransactionDiscount = 0 }) => ({
  price,
  memberDiscount,
  firstTransactionDiscount,
  finalPrice: price - memberDiscount - firstTransactionDiscount,
});

const row = (rows, key) => rows.find((r) => r.key === key);

describe("summarizeCart", () => {
  it("new customer, Rp850,000 purchase: discount Rp50,000, total Rp800,000", () => {
    const summary = summarizeCart([membership("m", 850_000)], {
      m: quote({ price: 850_000, firstTransactionDiscount: 50_000 }),
    });
    assert.equal(summary.subtotal, 850_000);
    assert.equal(summary.discount, 50_000);
    assert.equal(summary.firstTransactionDiscount, 50_000);
    assert.equal(summary.total, 800_000);
    assert.equal(summary.complete, true);
  });

  it("existing customer: the backend quotes no first transaction discount, so Rp0", () => {
    const summary = summarizeCart([membership("m", 850_000)], {
      m: quote({ price: 850_000 }),
    });
    assert.equal(summary.discount, 0);
    assert.equal(summary.total, 850_000);
  });

  it("uses the discount amount the backend returns, never a fixed value", () => {
    const summary = summarizeCart([pt("p", 1_200_000)], {
      p: quote({ price: 1_200_000, firstTransactionDiscount: 120_000 }),
    });
    assert.equal(summary.discount, 120_000);
    assert.equal(summary.total, 1_080_000);
  });

  it("applies to PT packages and drop-ins as well as memberships", () => {
    for (const item of [pt("x", 850_000), dropIn("x", 850_000)]) {
      const summary = summarizeCart([item], {
        x: quote({ price: 850_000, firstTransactionDiscount: 50_000 }),
      });
      assert.equal(summary.total, 800_000, item.kind);
    }
  });

  it("keeps an existing member discount alongside the first transaction discount", () => {
    const summary = summarizeCart([membership("m", 900_000)], {
      m: quote({ price: 1_000_000, memberDiscount: 100_000, firstTransactionDiscount: 50_000 }),
    });
    assert.equal(summary.subtotal, 1_000_000);
    assert.equal(summary.memberDiscount, 100_000);
    assert.equal(summary.firstTransactionDiscount, 50_000);
    assert.equal(summary.discount, 150_000);
    assert.equal(summary.total, 850_000);
  });

  it("counts the single-use discount once when several lines are quoted with it", () => {
    const summary = summarizeCart([membership("m", 850_000), pt("p", 500_000)], {
      m: quote({ price: 850_000, firstTransactionDiscount: 50_000 }),
      p: quote({ price: 500_000, firstTransactionDiscount: 50_000 }),
    });
    assert.equal(summary.firstTransactionDiscount, 50_000);
    assert.equal(summary.total, 1_300_000);
    assert.deepEqual(
      summary.lines.map((l) => l.firstTransactionDiscount),
      [50_000, 0]
    );
  });

  it("keeps the discount on whichever line the backend quoted it for", () => {
    // e.g. the offer is limited to PT packages: the membership comes back without it.
    const summary = summarizeCart([membership("m", 850_000), pt("p", 500_000)], {
      m: quote({ price: 850_000 }),
      p: quote({ price: 500_000, firstTransactionDiscount: 50_000 }),
    });
    assert.deepEqual(
      summary.lines.map((l) => l.firstTransactionDiscount),
      [0, 50_000]
    );
    assert.equal(summary.total, 1_300_000);
  });

  it("falls back to the cart price, flagged incomplete, when a line has no quote", () => {
    const summary = summarizeCart([membership("m", 850_000)], {});
    assert.equal(summary.total, 850_000);
    assert.equal(summary.discount, 0);
    assert.equal(summary.complete, false);
  });
});

describe("dropInLineQuote", () => {
  it("splits the backend discount into member and first transaction parts", () => {
    const line = dropInLineQuote({
      price: 125_000,
      discount: 75_000,
      finalPrice: 50_000,
      firstTransactionDiscount: 50_000,
    });
    assert.deepEqual(line, {
      price: 125_000,
      memberDiscount: 25_000,
      firstTransactionDiscount: 50_000,
      finalPrice: 50_000,
    });
  });

  it("treats a missing firstTransactionDiscount (older backend) as 0", () => {
    const line = dropInLineQuote({ price: 125_000, discount: 0, finalPrice: 125_000 });
    assert.equal(line.firstTransactionDiscount, 0);
  });
});

describe("priceSummaryRows", () => {
  it("backend discount 50,000: shows -Rp50,000 and a first transaction line", () => {
    const rows = priceSummaryRows(
      summarizeCart([membership("m", 850_000)], {
        m: quote({ price: 850_000, firstTransactionDiscount: 50_000 }),
      })
    );
    assert.deepEqual(row(rows, "subtotal"), { key: "subtotal", label: "Subtotal", amount: 850_000 });
    assert.equal(row(rows, "discount").amount, 50_000);
    assert.equal(row(rows, "discount").negative, true);
    assert.equal(row(rows, "first-transaction").amount, 50_000);
    assert.equal(row(rows, "total").amount, 800_000);
  });

  it("backend discount 0: the Discount row is still shown, as Rp0", () => {
    const rows = priceSummaryRows(
      summarizeCart([membership("m", 850_000)], { m: quote({ price: 850_000 }) })
    );
    assert.equal(row(rows, "discount").amount, 0);
    assert.equal(row(rows, "discount").negative, false);
    assert.equal(row(rows, "first-transaction"), undefined);
    assert.equal(row(rows, "total").amount, 850_000);
  });
});

describe("applyPayments (Pay amount)", () => {
  const items = [membership("m", 850_000)];
  const quoted = summarizeCart(items, {
    m: quote({ price: 850_000, firstTransactionDiscount: 50_000 }),
  });

  it("the Pay amount is the final amount, not the subtotal", () => {
    assert.equal(quoted.total, 800_000);
    assert.notEqual(quoted.total, quoted.subtotal);
  });

  it("switches to the created payment's finalAmount once it exists", () => {
    const summary = applyPayments(quoted, {
      m: { amount: 850_000, discount: 50_000, firstTransactionDiscount: 50_000, finalAmount: 800_000 },
    });
    assert.equal(summary.total, 800_000);
    assert.equal(summary.firstTransactionDiscount, 50_000);
  });

  it("trusts the payment over the quote when they disagree", () => {
    // Eligibility changed between the quote and the payment: the backend charged in full.
    const summary = applyPayments(quoted, {
      m: { amount: 850_000, discount: 0, firstTransactionDiscount: 0, finalAmount: 850_000 },
    });
    assert.equal(summary.total, 850_000);
    assert.equal(summary.discount, 0);
  });

  it("keeps the quote for lines whose payment does not exist yet", () => {
    const two = summarizeCart([membership("m", 850_000), pt("p", 500_000)], {
      m: quote({ price: 850_000, firstTransactionDiscount: 50_000 }),
      p: quote({ price: 500_000 }),
    });
    const summary = applyPayments(two, {
      m: { amount: 850_000, discount: 50_000, firstTransactionDiscount: 50_000, finalAmount: 800_000 },
      p: null,
    });
    assert.equal(summary.total, 1_300_000);
  });
});
