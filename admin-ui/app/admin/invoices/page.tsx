import { InvoicesView } from "@/components/admin/invoices-view";
import { PermissionGuard } from "@/components/admin/role-guard";
import { DATA_FINANCE_DENIED } from "@/lib/admin-routes";

export default function InvoicesPage() {
  return (
    <PermissionGuard permission="dataFinance.view" message={DATA_FINANCE_DENIED}>
      <InvoicesView />
    </PermissionGuard>
  );
}
