"use client";

import { useEffect, useMemo, useState } from "react";

import { getPurchaseQuote } from "@/lib/api/customer-benefits";
import { DROP_IN_CATEGORY, getDropInProducts, type DropInProduct } from "@/lib/api/drop-in";
import type { CartItem } from "@/lib/pos/cart";
import {
  dropInLineQuote,
  summarizeCart,
  type CartSummary,
  type LineQuote,
} from "@/lib/pos/pricing";

const NO_QUOTES: Record<string, LineQuote | undefined> = {};

type QuoteResult = {
  key: string;
  quotes: Record<string, LineQuote | undefined>;
};

/**
 * Backend pricing for the cart, for the selected customer.
 *
 * The cart price of a line is the catalogue price. What the customer is
 * actually charged — member discount, first transaction discount — is only
 * known to the backend, so each line is quoted through the same calculation
 * `POST /api/v1/payments` uses:
 *  - membership / PT package → `GET /api/v1/customer-benefits/quote`
 *  - drop-in → `GET /api/v1/drop-in/products?memberId=`
 *
 * A line whose quote fails keeps its cart price; it is never guessed at.
 */
export function usePosQuote(
  items: CartItem[],
  customerId: string | null | undefined,
  enabled = true
): { summary: CartSummary; loading: boolean } {
  const key = useMemo(
    () => (enabled && customerId ? `${customerId}|${items.map((i) => i.lineId).join(",")}` : ""),
    [enabled, customerId, items]
  );
  const [result, setResult] = useState<QuoteResult>({ key: "", quotes: NO_QUOTES });

  useEffect(() => {
    if (!key || !customerId) return;
    const controller = new AbortController();
    const options = { signal: controller.signal, redirectOn401: false };

    // One product list per branch covers every drop-in line sold there.
    const dropInLists = new Map<string, Promise<DropInProduct[]>>();
    const dropInProducts = (branchId: string) => {
      let pending = dropInLists.get(branchId);
      if (!pending) {
        pending = getDropInProducts(branchId, customerId, options);
        dropInLists.set(branchId, pending);
      }
      return pending;
    };

    const quoteLine = async (item: CartItem): Promise<LineQuote | undefined> => {
      switch (item.kind) {
        case "membership":
          return getPurchaseQuote({ memberId: customerId, membershipPlanId: item.plan.id }, options);
        case "pt":
          return getPurchaseQuote({ memberId: customerId, ptPackageId: item.pkg.id }, options);
        case "dropin": {
          const category =
            item.dropInKind === "pass" ? DROP_IN_CATEGORY.dayPass : DROP_IN_CATEGORY.singleVisit;
          const product = (await dropInProducts(item.branchId)).find(
            (p) => p.paymentCategory === category
          );
          return product ? dropInLineQuote(product) : undefined;
        }
      }
    };

    void Promise.allSettled(items.map(quoteLine)).then((settled) => {
      if (controller.signal.aborted) return;
      const quotes: Record<string, LineQuote | undefined> = {};
      settled.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") quotes[items[index].lineId] = outcome.value;
      });
      setResult({ key, quotes });
    });

    return () => controller.abort();
    // `key` already encodes the customer and the lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const quotes = key && result.key === key ? result.quotes : NO_QUOTES;
  const summary = useMemo(() => summarizeCart(items, quotes), [items, quotes]);

  return { summary, loading: !!key && result.key !== key };
}
