"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminPaths } from "@/lib/admin-routes";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import type { ApiMember } from "@/lib/api/members";
import { formatRupiah, hasPackage, type CartItem } from "@/lib/pos/cart";
import { branchLabel, usePosBranch } from "@/lib/pos/branch-context";
import { useTheme } from "@/lib/theme";
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
 * Front-desk POS shell — a kiosk, not an admin page.
 *
 * The admin layout drops its sidebar and header on this route, so everything
 * the till needs lives in this one bar: which branch is selling, the light/dark
 * switch, and the way back out. Below it, the catalogue on the left and the
 * customer + cart rail on the right, collapsing into a bottom drawer on tablets
 * so the checkout button is always reachable.
 */
export function PosView() {
  const router = useRouter();
  const { branches, branch, branchId, setBranchId, loading: branchLoading, error: branchError } =
    usePosBranch();
  const { theme, toggleTheme } = useTheme();

  const [customer, setCustomer] = useState<ApiMember | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; detail?: string } | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  /** Bumped after a class booking so the customer panel re-reads its context. */
  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/v1/auth/profile`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileData | null) => {
        if (data) setProfile(data);
      })
      .catch(() => null);
  }, []);

  /*
   * A cart is priced per branch and, for QRIS, settles against that branch's
   * own AsteriPay merchant. Carrying lines across a branch switch would bill the
   * wrong merchant, so the cart is emptied with the switch.
   *
   * Adjusted during render rather than in an effect: React re-runs this
   * component before committing, so the stale cart is never painted.
   */
  const [lastBranchId, setLastBranchId] = useState(branchId);
  if (branchId !== lastBranchId) {
    setLastBranchId(branchId);
    setItems([]);
    setNotice(null);
  }

  const addItem = useCallback(
    (item: CartItem) => {
      setNotice(null);
      if (!customer) {
        setNotice({ title: "Select a customer before adding items." });
        return;
      }
      if (item.kind === "pt" && hasPackage(items, item.pkg.id)) {
        setNotice({ title: "That PT package is already in the transaction." });
        return;
      }
      setItems((current) => [...current, item]);
    },
    [customer, items]
  );

  const removeItem = useCallback((lineId: string) => {
    setItems((current) => current.filter((i) => i.lineId !== lineId));
  }, []);

  /*
   * A settled sale ends the transaction, customer included.
   *
   * The next person in the queue is a different person: leaving the previous
   * customer selected means staff either sell to the wrong account or have to
   * clear the panel by hand before every sale. The context version is still
   * bumped so a customer re-selected straight after (a second purchase for the
   * same member) is read back fresh rather than from the pre-sale snapshot.
   */
  const resetTransaction = useCallback(() => {
    setItems([]);
    setCustomer(null);
    setCheckoutOpen(false);
    setCheckoutBusy(false);
    setDrawerOpen(false);
    setNotice(null);
    setContextVersion((v) => v + 1);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price, 0),
    [items]
  );

  const exitPos = useCallback(() => {
    if (checkoutBusy) return;
    router.push(adminPaths.dashboard);
  }, [checkoutBusy, router]);

  return (
    <div className="h-screen flex flex-col bg-dark overflow-hidden">
      {/* ---------- Kiosk bar ---------- */}
      <header className="shrink-0 border-b border-border bg-sidebar px-3 sm:px-5 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-sweat text-black grid place-items-center shrink-0">
            <i className="fas fa-cash-register" aria-hidden />
          </span>
          <div className="min-w-0 hidden sm:block">
            <p className="text-sm font-bold font-display uppercase text-fg leading-tight">
              Sweatbox POS
            </p>
            <p className="text-[11px] text-muted truncate">
              {profile?.fullName ?? "Front desk"}
              {profile?.roleName ? ` · ${profile.roleName}` : ""}
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Branch — the whole POS is scoped to it, so it sits front and centre */}
        <label className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase font-bold text-muted hidden md:inline">
            Branch
          </span>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={branchLoading || checkoutBusy}
            title={checkoutBusy ? "Complete the transaction first" : "Select branch"}
            className="bg-card border border-border text-fg rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-sweat disabled:opacity-50 max-w-[10rem] sm:max-w-none"
          >
            <option value="">
              {branchLoading ? "Loading…" : "Select branch"}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchLabel(b)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-10 h-10 grid place-items-center rounded-lg bg-card border border-border text-fg-soft hover:text-fg hover:border-sweat transition shrink-0"
        >
          <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`} aria-hidden />
        </button>

        <button
          type="button"
          onClick={exitPos}
          disabled={checkoutBusy}
          title={checkoutBusy ? "Complete the transaction first" : "Back to Admin Portal"}
          className="h-10 px-3 sm:px-4 rounded-lg bg-card border border-border text-fg-soft hover:text-fg hover:border-red-500/60 transition text-sm font-bold flex items-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i className="fas fa-right-from-bracket" aria-hidden />
          <span className="hidden sm:inline">Exit POS</span>
        </button>
      </header>

      <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col">
        {branchError && (
          <p className="mb-3 text-xs text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
            {branchError}
          </p>
        )}

        {notice && (
          <div className="mb-3 bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-yellow-600 font-semibold">
                {notice.title}
              </p>
              {notice.detail && (
                <p className="text-[11px] text-muted mt-1">{notice.detail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-muted hover:text-fg shrink-0"
              aria-label="Dismiss"
            >
              <i className="fas fa-times" aria-hidden />
            </button>
          </div>
        )}

        {!branchId && !branchLoading ? (
          <div className="flex-1 grid place-items-center">
            <div className="text-center max-w-sm">
              <i className="fas fa-store text-4xl text-muted mb-4 block" aria-hidden />
              <p className="text-lg font-bold text-fg mb-1">Select a branch first</p>
              <p className="text-sm text-muted">
                The catalog, prices, and payment merchant differ per branch, so the POS
                waits for a branch to be selected before showing any items.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 sm:gap-4">
            <div className="bg-card rounded-xl border border-border overflow-hidden min-h-0 flex flex-col">
              <PosCatalog
                onAdd={addItem}
                customer={customer}
                branchId={branchId}
                branchName={branch ? branchLabel(branch) : ""}
                cartItems={items}
                disabled={checkoutBusy}
                onBooked={() => setContextVersion((v) => v + 1)}
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
                className="lg:hidden fixed inset-0 z-40 bg-overlay backdrop-blur-sm"
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
                  <span className="text-[11px] uppercase font-bold tracking-wider text-muted">
                    Transaction
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="text-muted hover:text-fg text-xl leading-none"
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
                refreshKey={contextVersion}
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
        )}
      </div>

      {/* Tablet / phone: the checkout bar is always reachable */}
      {!drawerOpen && branchId && (
        <div className="lg:hidden shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full bg-sweat text-black px-4 py-3.5 flex items-center justify-between font-bold text-sm"
          >
            <span className="flex items-center gap-2">
              <i className="fas fa-receipt" aria-hidden />
              {items.length} item
            </span>
            <span>{formatRupiah(total)}</span>
            <span className="uppercase text-xs">Open transaction</span>
          </button>
        </div>
      )}

      {checkoutOpen && customer && (
        <PosCheckoutModal
          items={items}
          customer={customer}
          branchId={branchId}
          branchName={branch ? branchLabel(branch) : ""}
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
