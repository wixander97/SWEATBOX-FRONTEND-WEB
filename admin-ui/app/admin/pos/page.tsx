import { PosView } from "@/components/admin/pos/pos-view";
import { RoleGuard } from "@/components/admin/role-guard";

export default function PosPage() {
  return (
    <RoleGuard allow={["superadmin", "admin", "staff"]}>
      <PosView />
    </RoleGuard>
  );
}
