"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-dark">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <AdminHeader onOpenMenu={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
