"use client";

import Link from "next/link";
import {
  members,
  classes,
  getExpiringMembersCount,
  recentTransactionAmount,
} from "@/lib/mock-data";
import { adminPaths } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";

export function DashboardView() {
  const { currentRole } = useRole();
  const expiringMembersCount = getExpiringMembersCount(members);
  const txRows = members.slice(0, 4);

  return (
    <>
      {expiringMembersCount > 0 ? (
        <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-xl mb-6 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-4 text-yellow-500">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-xl" aria-hidden />
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">
                Upcoming Expiry Alert
              </p>
              <p className="text-xs text-yellow-500/80 mt-1">
                Terdapat{" "}
                <strong>{expiringMembersCount} member</strong> yang masa aktifnya
                akan habis dalam waktu kurang dari 5 hari (H-5).
              </p>
            </div>
          </div>
          <Link
            href={adminPaths.members}
            className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-yellow-400 transition"
          >
            Lihat Data
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-xl border border-border transition hover:border-sweat/50 cursor-default">
          <p className="text-gray-400 text-xs font-bold uppercase mb-2">
            Total Active Members
          </p>
          <h3 className="text-3xl font-bold text-white flex items-end gap-2">
            1,240{" "}
            <span className="text-green-500 text-sm font-normal mb-1">▲ 12%</span>
          </h3>
        </div>

        {currentRole === "owner" ? (
          <div className="bg-card p-6 rounded-xl border border-border transition hover:border-sweat/50 cursor-default">
            <p className="text-gray-400 text-xs font-bold uppercase mb-2">
              Revenue (Monthly)
            </p>
            <h3 className="text-3xl font-bold text-sweat flex items-end gap-2">
              IDR 450M{" "}
              <span className="text-gray-500 text-sm font-normal mb-1">
                / Target 500M
              </span>
            </h3>
          </div>
        ) : (
          <div className="bg-card p-6 rounded-xl border border-dashed border-gray-700 flex flex-col items-center justify-center opacity-75">
            <i className="fas fa-lock text-gray-500 text-xl mb-2" aria-hidden />
            <p className="text-gray-500 text-xs font-bold uppercase text-center">
              Restricted View
            </p>
            <p className="text-[10px] text-gray-600 mt-1">Owner / Manager Only</p>
          </div>
        )}

        <div className="bg-card p-6 rounded-xl border border-border transition hover:border-sweat/50 cursor-default">
          <p className="text-gray-400 text-xs font-bold uppercase mb-2">
            Class Occupancy
          </p>
          <h3 className="text-3xl font-bold text-white flex items-end gap-2">
            78%{" "}
            <span className="text-yellow-500 text-sm font-normal mb-1">Avg</span>
          </h3>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border transition hover:border-sweat/50 cursor-default">
          <p className="text-gray-400 text-xs font-bold uppercase mb-2">
            Staff Checked In
          </p>
          <h3 className="text-3xl font-bold text-white flex items-end gap-2">
            12{" "}
            <span className="text-gray-500 text-sm font-normal mb-1">
              / 15 Staff
            </span>
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h4 className="font-bold text-lg">Recent Transactions</h4>
            <Link
              href={adminPaths.members}
              className="text-xs text-sweat hover:underline"
            >
              View All
            </Link>
          </div>
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
              <tr>
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {txRows.map((m) => (
                <tr key={m.id} className="table-row transition">
                  <td className="px-6 py-4 font-medium text-white">{m.name}</td>
                  <td className="px-6 py-4">{m.plan}</td>
                  <td className="px-6 py-4 text-white">
                    {recentTransactionAmount}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        m.payment === "Paid"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {m.payment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-lg">Today&apos;s Classes</h4>
            <span className="text-xs bg-sweat text-black px-2 py-1 rounded font-bold shadow-[0_0_10px_rgba(255,215,0,0.5)]">
              LIVE
            </span>
          </div>
          <div className="space-y-4">
            {classes.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-white/5 transition"
              >
                <div className="w-16 h-16 bg-gray-800 rounded-lg flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-gray-400">TIME</span>
                  <span className="text-lg font-bold text-white">{c.time}</span>
                </div>
                <div className="flex-1">
                  <h5 className="font-bold text-white">{c.name}</h5>
                  <p className="text-sm text-gray-400">
                    {c.trainer} • {c.location}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-sweat">
                    {c.enrolled}
                    <span className="text-sm text-gray-500">/{c.capacity}</span>
                  </p>
                  <p className="text-xs text-gray-500">Booked</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
