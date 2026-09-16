import { PaymentsView } from "@/components/admin/payments/payments-view";
import { PermissionGuard } from "@/components/admin/role-guard";
import { DATA_FINANCE_DENIED } from "@/lib/admin-routes";

type StatusTab = "all" | "paid" | "pending" | "failed";
const ALLOWED_TABS: StatusTab[] = ["all", "paid", "pending", "failed"];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp?.status;
  const initialStatus =
    raw && (ALLOWED_TABS as string[]).includes(raw) ? (raw as StatusTab) : undefined;

  return (
    <PermissionGuard permission="dataFinance.view" message={DATA_FINANCE_DENIED}>
      <PaymentsView initialStatus={initialStatus} />
    </PermissionGuard>
  );
}
