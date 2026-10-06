import { LoyaltyView, type LoyaltyTab } from "@/components/admin/loyalty/loyalty-view";
import { PermissionGuard } from "@/components/admin/role-guard";

// Kept here (not imported from the client module, whose values a server
// component only sees as client references).
const TABS: LoyaltyTab[] = [
  "overview",
  "rewards",
  "customers",
  "ledger",
  "vouchers",
  "first-transaction",
  "referral-program",
  "referrals",
];

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; memberId?: string; name?: string; code?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp?.tab && (TABS as string[]).includes(sp.tab) ? (sp.tab as LoyaltyTab) : undefined;
  const member = sp?.memberId
    ? { id: sp.memberId, name: sp.name ?? "", code: sp.code ?? "" }
    : null;

  return (
    <PermissionGuard
      permission="loyalty.read"
      message="Loyalty & Benefits is available to Super Admin, Admin and Staff."
    >
      <LoyaltyView initialTab={tab ?? (member ? "ledger" : undefined)} initialMember={member} />
    </PermissionGuard>
  );
}
