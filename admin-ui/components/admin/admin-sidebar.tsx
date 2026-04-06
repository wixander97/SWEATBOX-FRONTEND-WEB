"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { adminPaths } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";

const mainNav: { href: string; label: string; icon: string; id: string }[] = [
  { href: adminPaths.dashboard, label: "Dashboard", icon: "fa-chart-pie", id: "dashboard" },
  { href: adminPaths.classes, label: "Class Schedule", icon: "fa-calendar-alt", id: "classes" },
  { href: adminPaths.members, label: "Memberships", icon: "fa-users", id: "members" },
  { href: adminPaths.reports, label: "Attendance Reports", icon: "fa-clipboard-check", id: "reports" },
  { href: adminPaths.coaches, label: "Coach Management", icon: "fa-dumbbell", id: "coaches" },
];

const dataNav: { href: string; label: string; icon: string; id: string }[] = [
  { href: adminPaths.workout, label: "Workout Master", icon: "fa-running", id: "workout" },
  { href: adminPaths.payroll, label: "Coaches Payroll", icon: "fa-file-invoice-dollar", id: "payroll" },
];

function navButtonClasses(active: boolean) {
  const base =
    "nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition ";
  if (active) {
    return base + "bg-sweat text-black font-bold";
  }
  return base + "hover:bg-white/10 text-gray-400 hover:text-white";
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { displayName, displayRole } = useRole();

  return (
    <aside className="w-64 bg-sidebar border-r border-border flex flex-col justify-between overflow-y-auto">
      <div>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-sweat rounded flex items-center justify-center font-bold text-black font-display text-lg">
            S
          </div>
          <h1 className="font-display text-xl font-bold tracking-wider text-white">
            SWEATBOX <span className="text-sweat text-xs align-top">ADMIN</span>
          </h1>
        </div>

        <nav className="mt-2 px-4 space-y-1 pb-4">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.id}`}
              className={navButtonClasses(pathname === item.href)}
            >
              <i className={`fas ${item.icon} w-5`} aria-hidden />
              {item.label}
            </Link>
          ))}

          <div className="pt-4 mt-2 border-t border-gray-800">
            <p className="px-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
              Data &amp; Finance
            </p>
            {dataNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.id}`}
                className={navButtonClasses(pathname === item.href)}
              >
                <i className={`fas ${item.icon} w-5`} aria-hidden />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 px-4 py-2">
          <Image
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
            unoptimized
          />
          <div>
            <p className="text-sm font-bold text-white" id="logged-in-name">
              {displayName}
            </p>
            <p className="text-xs text-gray-500" id="logged-in-role">
              {displayRole}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
