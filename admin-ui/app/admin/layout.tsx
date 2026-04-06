import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <AdminHeader />
        <div className="flex-1 overflow-y-auto p-8 fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
