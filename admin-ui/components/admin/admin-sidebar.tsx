"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { adminPaths } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";

type ProfileData = {
  fullName?: string | null;
  email?: string | null;
  roleName?: string | null;
  role?: string | null;
  profileImageUrl?: string | null;
};

const mainNav: { href: string; label: string; icon: string; id: string }[] = [
  { href: adminPaths.dashboard, label: "Dashboard", icon: "fa-chart-pie", id: "dashboard" },
  { href: adminPaths.classes, label: "Class Schedule", icon: "fa-calendar-alt", id: "classes" },
  { href: adminPaths.members, label: "Memberships", icon: "fa-users", id: "members" },
  { href: adminPaths.reports, label: "Attendance Reports", icon: "fa-clipboard-check", id: "reports" },
  { href: adminPaths.coaches, label: "Coach Management", icon: "fa-dumbbell", id: "coaches" },
];

const dataNav: { href: string; label: string; icon: string; id: string }[] = [
  { href: adminPaths.payments, label: "Payments", icon: "fa-credit-card", id: "payments" },
  { href: adminPaths.workout, label: "Workout Master", icon: "fa-running", id: "workout" },
  { href: adminPaths.payroll, label: "Coaches Payroll", icon: "fa-file-invoice-dollar", id: "payroll" },
  { href: adminPaths.users, label: "User Management", icon: "fa-user-shield", id: "users" },
];

function navButtonClasses(active: boolean) {
  const base =
    "nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition ";
  if (active) {
    return base + "bg-sweat text-black font-bold";
  }
  return base + "hover:bg-white/10 text-gray-400 hover:text-white";
}

type Props = {
  open?: boolean;
  onClose?: () => void;
};

export function AdminSidebar({ open = false, onClose }: Props) {
  const pathname = usePathname();
  const { displayName, displayRole } = useRole();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetch("/api/auth/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileData | null) => { if (data) setProfile(data); })
      .catch(() => null);
  }, []);

  const name = profile?.fullName ?? displayName;
  const role = profile?.roleName ?? profile?.role ?? displayRole;
  const avatarUrl = profile?.profileImageUrl
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar overlay"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-sidebar border-r border-border flex flex-col justify-between overflow-y-auto transform transition-transform lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="p-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sweat rounded flex items-center justify-center font-bold text-black font-display text-lg">
                S
              </div>
              <h1 className="font-display text-xl font-bold tracking-wider text-white">
                SWEATBOX <span className="text-sweat text-xs align-top">ADMIN</span>
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-white text-xl"
              aria-label="Close menu"
            >
              ×
            </button>
          </div>

          <nav className="mt-2 px-4 space-y-1 pb-4">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.id}`}
                onClick={onClose}
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
                  onClick={onClose}
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
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="w-8 h-8 rounded-full"
              unoptimized
            />
            <div>
              <p className="text-sm font-bold text-white" id="logged-in-name">
                {name}
              </p>
              <p className="text-xs text-gray-500" id="logged-in-role">
                {role}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm border border-border transition"
          >
            <i className="fas fa-sign-out-alt mr-2" aria-hidden />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
