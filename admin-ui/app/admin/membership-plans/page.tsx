import { MembershipPlansView } from "@/components/admin/membership-plans-view";
import { PermissionGuard } from "@/components/admin/role-guard";
import { DATA_FINANCE_DENIED } from "@/lib/admin-routes";

export default function MembershipPlansPage() {
  return (
    <PermissionGuard permission="dataFinance.view" message={DATA_FINANCE_DENIED}>
      <MembershipPlansView />
    </PermissionGuard>
  );
}
