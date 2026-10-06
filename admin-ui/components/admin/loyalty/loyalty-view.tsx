"use client";

import { useState } from "react";
import { useRole } from "@/contexts/role-context";
import { AdjustPointsModal, type PickedMember } from "./adjust-points-modal";
import { FirstTransactionTab } from "./first-transaction-tab";
import { LoyaltyCustomersTab } from "./loyalty-customers-tab";
import { LoyaltyLedgerTab } from "./loyalty-ledger-tab";
import { LoyaltyRewardsTab } from "./loyalty-rewards-tab";
import { LoyaltySettingsTab } from "./loyalty-settings-tab";
import { LoyaltyVouchersTab } from "./loyalty-vouchers-tab";
import { ReferralProgramTab } from "./referral-program-tab";
import { ReferralsTab } from "./referrals-tab";

export type LoyaltyTab =
  | "overview"
  | "rewards"
  | "customers"
  | "ledger"
  | "vouchers"
  | "first-transaction"
  | "referral-program"
  | "referrals";

const TABS: { id: LoyaltyTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "fa-sliders" },
  { id: "rewards", label: "Rewards", icon: "fa-gift" },
  { id: "customers", label: "Customers", icon: "fa-users" },
  { id: "ledger", label: "Ledger", icon: "fa-list" },
  { id: "vouchers", label: "Vouchers", icon: "fa-ticket" },
  { id: "first-transaction", label: "First Transaction", icon: "fa-tag" },
  { id: "referral-program", label: "Referral Program", icon: "fa-handshake" },
  { id: "referrals", label: "Referrals", icon: "fa-user-plus" },
];

/** Tabs that show the "Adjust points" shortcut. */
const ADJUST_TABS: LoyaltyTab[] = ["overview", "rewards", "ledger", "vouchers", "referrals"];

/**
 * Loyalty & Benefits: earning rule, reward catalogue, member balances, the
 * points ledger, voucher redemption, the first transaction discount and the
 * referral programme. Every number comes from the backend
 * (`/api/v1/loyalty`, `/api/v1/customer-benefits`, `/api/v1/referrals`).
 */
export function LoyaltyView({
  initialTab = "overview",
  initialMember = null,
}: {
  initialTab?: LoyaltyTab;
  initialMember?: PickedMember | null;
}) {
  const { can } = useRole();
  const canWrite = can("loyalty.write");
  const [tab, setTab] = useState<LoyaltyTab>(initialTab);
  const [ledgerMember, setLedgerMember] = useState<PickedMember | null>(initialMember);
  /** `undefined` = closed; `null` = open with no member picked yet. */
  const [adjusting, setAdjusting] = useState<PickedMember | null | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <h2 className="text-lg font-display font-bold uppercase text-fg">
          <i className="fas fa-gift text-accent-ink mr-2" aria-hidden />
          Loyalty &amp; Benefits
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div
            role="tablist"
            aria-label="Loyalty and benefits sections"
            className="flex overflow-x-auto bg-sidebar border border-border rounded-lg p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition inline-flex items-center gap-2 whitespace-nowrap ${
                  tab === t.id ? "bg-sweat text-black font-bold" : "text-muted hover:text-fg"
                }`}
              >
                <i className={`fas ${t.icon}`} aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
          {canWrite && ADJUST_TABS.includes(tab) ? (
            <button
              type="button"
              onClick={() => setAdjusting(null)}
              className="bg-sidebar border border-border text-fg px-3 py-2 rounded-lg text-sm hover:bg-fg/5 transition inline-flex items-center gap-2 self-start"
            >
              <i className="fas fa-plus-minus" aria-hidden />
              Adjust points
            </button>
          ) : null}
        </div>
      </div>

      {tab === "overview" ? <LoyaltySettingsTab /> : null}
      {tab === "rewards" ? <LoyaltyRewardsTab /> : null}
      {tab === "customers" ? (
        <LoyaltyCustomersTab
          refreshKey={refreshKey}
          onOpenLedger={(member) => {
            setLedgerMember(member);
            setTab("ledger");
          }}
          onAdjust={(member) => setAdjusting(member)}
        />
      ) : null}
      {tab === "ledger" ? (
        <LoyaltyLedgerTab
          member={ledgerMember}
          onClearMember={() => setLedgerMember(null)}
          refreshKey={refreshKey}
        />
      ) : null}
      {tab === "vouchers" ? <LoyaltyVouchersTab /> : null}
      {tab === "first-transaction" ? <FirstTransactionTab /> : null}
      {tab === "referral-program" ? <ReferralProgramTab /> : null}
      {tab === "referrals" ? <ReferralsTab /> : null}

      {adjusting !== undefined ? (
        <AdjustPointsModal
          member={adjusting}
          onClose={() => setAdjusting(undefined)}
          onAdjusted={() => setRefreshKey((k) => k + 1)}
        />
      ) : null}
    </div>
  );
}
