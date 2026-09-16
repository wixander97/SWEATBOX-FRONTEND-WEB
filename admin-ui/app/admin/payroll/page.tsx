import { PayrollView } from "@/components/admin/payroll-view";
import { PermissionGuard } from "@/components/admin/role-guard";
import { DATA_FINANCE_DENIED } from "@/lib/admin-routes";

export default function PayrollPage() {
  return (
    <PermissionGuard permission="dataFinance.view" message={DATA_FINANCE_DENIED}>
      <PayrollView />
    </PermissionGuard>
  );
}
