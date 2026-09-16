import { HistoryView } from "@/components/admin/history-view";
import { PermissionGuard } from "@/components/admin/role-guard";
import { DATA_FINANCE_DENIED } from "@/lib/admin-routes";

export default function HistoryPage() {
  return (
    <PermissionGuard permission="dataFinance.view" message={DATA_FINANCE_DENIED}>
      <HistoryView />
    </PermissionGuard>
  );
}
