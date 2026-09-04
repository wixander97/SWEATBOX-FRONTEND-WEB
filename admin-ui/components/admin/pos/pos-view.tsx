"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import type { ApiMember } from "@/lib/api/members";
import { formatRupiah, hasClass, type CartItem } from "@/lib/pos/cart";
import { PosCatalog } from "./pos-catalog";
import { PosCartPanel } from "./pos-cart-panel";
import { PosCustomerPanel } from "./pos-customer-panel";
import { PosCheckoutModal } from "./pos-checkout-modal";

type ProfileData = {
  fullName?: string | null;
  roleName?: string | null;
  role?: string | null;
  branchName?: string | null;
};

/**
 * Front-desk POS shell.
 *
 * Left: catalogue (search + categories + item cards).
 * Right: selected customer, cart, totals and checkout — collapsing into a
 * bottom drawer on tablet/phone so the checkout button is always reachable.
 */
export function PosView() {
  const [customer, setCustomer] = useState<ApiMember | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; detail?: string } | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/v1/auth/profile`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileData | null) => {
        if (data) setProfile(data);
      })
      .catch(() => null);
  }, []);

  const bookedScheduleIds = useMemo(
    () => items.filter((i) => i.kind === "class").map((i) => i.schedule.id),
    [items]
  );

  const addItem = useCallback(
    (item: CartItem) => {
      setNotice(null);
      if (!customer) {
        setNotice({ title: "Pilih customer dulu sebelum menambah item." });
        return;
      }
      if (item.kind === "class" && hasClass(items, item.schedule.id)) {
        setNotice({ title: "Class tersebut sudah ada di cart." });
        return;
      }
      setItems((current) => [...current, item]);
    },
    [customer, items]
  );

  const removeItem = useCallback((lineId: string) => {
    setItems((current) => current.filter((i) => i.lineId !== lineId));
  }, []);

  const resetTransaction = useCallback(() => {
    setItems([]);
    setCheckoutOpen(false);
    setCheckoutBusy(false);
    setDrawerOpen(false);
    setNotice(null);
  }, []);

  const total = items.reduce((sum, i) => sum + i.price, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[560px]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display uppercase text-white">
            Sweatbox POS
          </h1>
          <p className="text-xs text-gray-500 truncate">
            Front desk · {profile?.fullName ?? "Staff"}
            {profile?.roleName ? ` (${profile.roleName})` : ""}
            {profile?.branchName ? ` · ${profile.branchName}` : ""}
          </p>
        </div>
      </div>

      {notice && (
        <div className="mb-3 bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-yellow-400 font-semibold">{notice.title}</p>
            {notice.detail && (
              <p className="text-[11px] text-gray-400 mt-1">{notice.detail}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-gray-500 hover:text-white shrink-0"
            aria-label="Dismiss"
          >
            <i className="fas fa-times" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="bg-card rounded-xl border border-border overflow-hidden min-h-0 flex flex-col">
          <PosCatalog
            onAdd={addItem}
            bookedScheduleIds={bookedScheduleIds}
            disabled={checkoutBusy}
          />
        </div>

        {/*
          One panel instance for both layouts: a persistent right rail on
          desktop, and the same tree promoted to a bottom drawer on small
          screens. Rendering it twice would double every customer-context fetch.
        */}
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
        )}
        <aside
          className={`bg-card border border-border overflow-hidden flex-col min-h-0 lg:static lg:z-auto lg:flex lg:max-h-none lg:rounded-xl lg:border ${
            drawerOpen
              ? "flex fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-2xl"
              : "hidden rounded-xl"
          }`}
        >
          {drawerOpen && (
            <div className="lg:hidden flex justify-between items-center px-4 pt-3">
              <span className="text-[11px] uppercase font-bold tracking-wider text-gray-500">
                Transaksi
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          )}
          <PosCustomerPanel
            customer={customer}
            onSelect={(member) => {
              setCustomer(member);
              if (!member) setItems([]);
            }}
            locked={checkoutBusy}
          />
          <PosCartPanel
            items={items}
            onRemove={removeItem}
            onClear={() => setItems([])}
            onCheckout={() => setCheckoutOpen(true)}
            hasCustomer={!!customer}
            disabled={checkoutBusy}
          />
        </aside>
      </div>

      {/* Tablet / phone: the checkout bar is always reachable */}
      {!drawerOpen && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full bg-sweat text-black px-4 py-3.5 flex items-center justify-between font-bold text-sm shadow-2xl"
          >
            <span className="flex items-center gap-2">
              <i className="fas fa-shopping-cart" aria-hidden />
              {items.length} item
            </span>
            <span>{formatRupiah(total)}</span>
            <span className="uppercase text-xs">Buka cart</span>
          </button>
        </div>
      )}

      {checkoutOpen && customer && (
        <PosCheckoutModal
          items={items}
          customer={customer}
          onClose={() => {
            setCheckoutOpen(false);
            setCheckoutBusy(false);
          }}
          onCompleted={resetTransaction}
          onBusyChange={setCheckoutBusy}
        />
      )}
    </div>
  );
}
