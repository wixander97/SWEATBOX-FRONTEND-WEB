import { PaymentMethodsView } from "@/components/admin/payments/payment-methods-view";
import { PermissionGuard } from "@/components/admin/role-guard";
import { DATA_FINANCE_DENIED } from "@/lib/admin-routes";

export default function PaymentMethodsPage() {
  return (
    <PermissionGuard permission="dataFinance.view" message={DATA_FINANCE_DENIED}>
      <PaymentMethodsView />
    </PermissionGuard>
  );
}
