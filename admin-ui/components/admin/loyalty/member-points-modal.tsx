"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Modal, SecondaryButton } from "@/components/ui/modal";
import { adminPaths } from "@/lib/admin-routes";
import { getMemberBenefits, type MemberBenefits } from "@/lib/api/customer-benefits";
import { errorMessageOf } from "@/lib/api/http";
import { getLoyaltyAccount, type LoyaltyBalance } from "@/lib/api/loyalty";
import { formatCurrency } from "@/lib/format";
import { jakartaDate } from "@/lib/jakarta-time";

type Props = {
  memberId: string;
  memberName: string;
  memberCode: string;
  onClose: () => void;
};

const REFERRAL_TONE: Record<string, BadgeTone> = {
  Pending: "warning",
  Qualified: "info",
  Rewarded: "success",
  Cancelled: "neutral",
};

/** First transaction discount, referral code and referral status for a member. */
function BenefitsSection({ benefits }: { benefits: MemberBenefits }) {
  const ftd = benefits.firstTransactionDiscount;
  let ftdNode: ReactNode;
  if (ftd?.used) {
    const parts = [
      ftd.usedOnInvoiceNo || null,
      ftd.usedAmount != null ? formatCurrency(ftd.usedAmount) : null,
    ].filter(Boolean);
    ftdNode = (
      <span className="text-fg">
        Used on {jakartaDate(ftd.usedAt)}
        {parts.length ? <span className="text-muted"> ({parts.join(", ")})</span> : null}
      </span>
    );
  } else if (ftd?.eligible) {
    ftdNode = <Badge tone="success">Available</Badge>;
  } else {
    ftdNode = (
      <span className="text-muted">
        Not eligible{ftd && !ftd.programActive ? " (programme not active)" : ""}
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-sidebar divide-y divide-border text-sm">
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <span className="text-muted">First transaction discount</span>
        <span className="text-right">{ftdNode}</span>
      </div>
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <span className="text-muted">Referral code</span>
        {benefits.referralCode ? (
          <span className="font-mono text-accent-ink">{benefits.referralCode}</span>
        ) : (
          <span className="text-muted">Not generated yet</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <span className="text-muted">Referred by</span>
        {benefits.referredBy ? (
          <span className="text-right">
            <span className="text-fg">{benefits.referredBy.referrerName || "—"}</span>
            {benefits.referredBy.referrerCode ? (
              <span className="font-mono text-[11px] text-accent-ink ml-1">
                {benefits.referredBy.referrerCode}
              </span>
            ) : null}
            <span className="text-muted"> — </span>
            <Badge tone={REFERRAL_TONE[benefits.referredBy.status] ?? "neutral"}>
              {benefits.referredBy.status}
            </Badge>
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <span className="text-muted">Successful referrals</span>
        <span className="text-fg font-bold">{benefits.successfulReferrals ?? 0}</span>
      </div>
    </div>
  );
}

/**
 * One member's loyalty points (`GET /api/v1/loyalty/accounts/{memberId}`) and
 * benefits (`GET /api/v1/customer-benefits/members/{memberId}`), opened from
 * the Members table so the table itself makes no extra calls.
 */
export function MemberPointsModal({ memberId, memberName, memberCode, onClose }: Props) {
  const [account, setAccount] = useState<LoyaltyBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [benefits, setBenefits] = useState<MemberBenefits | null>(null);
  const [benefitsError, setBenefitsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMemberBenefits(memberId)
      .then((data) => {
        if (!cancelled) setBenefits(data);
      })
      .catch((err) => {
        if (!cancelled) setBenefitsError(errorMessageOf(err, "Failed to load the member's benefits"));
      });
    getLoyaltyAccount(memberId)
      .then((data) => {
        if (!cancelled) setAccount(data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessageOf(err, "Failed to load the member's points"));
      });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const ledgerHref = `${adminPaths.loyalty}?${new URLSearchParams({
    tab: "ledger",
    memberId,
    name: memberName,
    code: memberCode,
  }).toString()}`;

  return (
    <Modal open onClose={onClose} title="Loyalty & benefits" subtitle={`${memberName} · ${memberCode}`}>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !account ? (
        <div className="flex items-center justify-center gap-3 text-muted text-sm py-6">
          <i className="fas fa-circle-notch fa-spin text-accent-ink" aria-hidden />
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center py-2">
            <p className="text-xs uppercase font-bold text-muted">Balance</p>
            <p className="text-4xl font-display font-bold text-accent-ink">{account.balance}</p>
            <p className="text-xs text-muted">points</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-sidebar p-3 text-center">
              <p className="text-[11px] uppercase font-bold text-muted">Total earned</p>
              <p className="text-lg font-bold text-success">{account.totalEarned}</p>
            </div>
            <div className="rounded-lg border border-border bg-sidebar p-3 text-center">
              <p className="text-[11px] uppercase font-bold text-muted">Total redeemed</p>
              <p className="text-lg font-bold text-fg">{account.totalRedeemed}</p>
            </div>
          </div>
          {!account.isEnabled ? (
            <p className="text-xs text-warning">The loyalty programme is currently switched off.</p>
          ) : null}
        </div>
      )}
      <div className="mt-5">
        <p className="text-xs uppercase font-bold text-muted mb-2">Benefits</p>
        {benefitsError ? (
          <p className="text-sm text-danger">{benefitsError}</p>
        ) : !benefits ? (
          <div className="flex items-center gap-3 text-muted text-sm py-3">
            <i className="fas fa-circle-notch fa-spin text-accent-ink" aria-hidden />
            Loading benefits…
          </div>
        ) : (
          <BenefitsSection benefits={benefits} />
        )}
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        <Link
          href={ledgerHref}
          className="bg-sweat text-black font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition inline-flex items-center justify-center gap-2"
        >
          <i className="fas fa-list" aria-hidden />
          View ledger
        </Link>
      </div>
    </Modal>
  );
}
