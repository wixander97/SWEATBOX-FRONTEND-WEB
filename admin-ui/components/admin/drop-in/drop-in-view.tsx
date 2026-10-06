"use client";

import { useState } from "react";
import { DropInPassesTab } from "./drop-in-passes-tab";
import { DropInProductsTab } from "./drop-in-products-tab";

type Tab = "products" | "passes";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "products", label: "Products", icon: "fa-tags" },
  { id: "passes", label: "Passes", icon: "fa-ticket" },
];

/**
 * Drop In: the products sold per branch (One Day Pass, Single Visit) and the
 * passes members hold.
 */
export function DropInView() {
  const [tab, setTab] = useState<Tab>("products");

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-display font-bold uppercase text-fg">Drop In</h2>
        <div role="tablist" aria-label="Drop In sections" className="inline-flex bg-sidebar border border-border rounded-lg p-1 self-start">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm transition inline-flex items-center gap-2 ${
                tab === t.id ? "bg-sweat text-black font-bold" : "text-muted hover:text-fg"
              }`}
            >
              <i className={`fas ${t.icon}`} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "products" ? <DropInProductsTab /> : <DropInPassesTab />}
    </div>
  );
}
