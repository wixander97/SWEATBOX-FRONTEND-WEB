"use client";

import { usePathname } from "next/navigation";
import { pageTitleByPath } from "@/lib/admin-routes";
import { useRole, type SimulatedRole } from "@/contexts/role-context";

export function AdminHeader() {
  const pathname = usePathname();
  const { currentRole, setCurrentRole } = useRole();
  const title = pageTitleByPath[pathname] ?? "Sweatbox Admin";

  return (
    <header className="h-16 bg-sidebar border-b border-border flex justify-between items-center px-8">
      <h2 className="text-xl font-bold font-display uppercase tracking-wide">
        {title}
      </h2>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border border-gray-700">
          <span className="text-xs text-gray-400 font-bold">
            <i className="fas fa-eye text-sweat mr-1" aria-hidden /> View As:
          </span>
          <select
            id="role-simulator"
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value as SimulatedRole)}
            className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer appearance-none"
            aria-label="Simulate role"
          >
            <option value="owner">Owner / Manager</option>
            <option value="admin">Admin / Staff</option>
          </select>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        <button
          type="button"
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-gray-400 hover:text-white hover:border-sweat transition relative"
          aria-label="Notifications"
        >
          <i className="fas fa-bell" aria-hidden />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button
          type="button"
          className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
        >
          <i className="fas fa-plus mr-2" aria-hidden />
          Quick Action
        </button>
      </div>
    </header>
  );
}
