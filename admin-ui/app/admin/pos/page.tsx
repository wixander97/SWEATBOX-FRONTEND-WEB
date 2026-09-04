import { PosView } from "@/components/admin/pos/pos-view";
import { RoleGuard } from "@/components/admin/role-guard";
import { PosBranchProvider } from "@/lib/pos/branch-context";
import { PosThemeProvider } from "@/lib/pos/pos-theme";

export default function PosPage() {
  return (
    <RoleGuard allow={["superadmin", "admin", "staff"]}>
      {/*
        Both providers wrap the whole till: the branch decides what is sellable
        and which merchant settles it, and the theme is written onto <html> so
        the printed-receipt portal is covered by it too.
      */}
      <PosThemeProvider>
        <PosBranchProvider>
          <PosView />
        </PosBranchProvider>
      </PosThemeProvider>
    </RoleGuard>
  );
}
