import { PosView } from "@/components/admin/pos/pos-view";
import { RoleGuard } from "@/components/admin/role-guard";
import { PosBranchProvider } from "@/lib/pos/branch-context";

export default function PosPage() {
  return (
    <RoleGuard allow={["superadmin", "admin", "staff"]}>
      {/*
        The branch decides what is sellable and which merchant settles it. The
        theme is no longer scoped here: it is an app-wide preference mounted in
        the root layout, so the till and the portal behind it agree.
      */}
      <PosBranchProvider>
        <PosView />
      </PosBranchProvider>
    </RoleGuard>
  );
}
