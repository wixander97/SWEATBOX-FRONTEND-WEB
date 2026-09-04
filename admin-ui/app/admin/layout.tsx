"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { adminPaths } from "@/lib/admin-routes";
import { HelpAssistant } from "@/components/help/help-assistant";
import { useSidebarCollapsed } from "@/lib/sidebar-collapse";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Two independent things: the mobile drawer (transient) and the desktop
  // collapse to an icon rail (a remembered preference).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const pathname = usePathname();

  /*
   * The POS runs as a kiosk: no sidebar, no header, no page padding, so a busy
   * front desk sees a till and not a page of an admin portal. It keeps its
   * /admin/pos URL — and therefore its route guard and its place in the nav —
   * and provides its own Exit POS control to come back here.
   */
  const isPos = pathname?.startsWith(adminPaths.pos) ?? false;

  if (isPos) {
    return (
      <div className="h-screen overflow-hidden bg-dark">
        {children}
        <HelpAssistant />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-dark">
      <AdminSidebar
        open={sidebarOpen}
        collapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={toggleCollapsed}
      />
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <AdminHeader onOpenMenu={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 fade-in">
          {children}
        </div>
      </main>
      <HelpAssistant />
    </div>
  );
}
