"use client";

import Image from "next/image";
import { useState } from "react";
import { members, type Member } from "@/lib/mock-data";

type FilterTab = "all" | "active";

function filterMembers(list: Member[], tab: FilterTab): Member[] {
  if (tab === "active") {
    return list.filter(
      (m) => m.status === "Active" || m.status === "Expiring Soon"
    );
  }
  return list;
}

function statusStyle(status: string) {
  let s = "bg-gray-500/10 text-gray-500";
  if (status === "Active") {
    s = "bg-green-500/10 text-green-500 border border-green-500/20";
  }
  if (status === "Expiring Soon") {
    s =
      "bg-yellow-500/10 text-yellow-500 border border-yellow-500/50 animate-pulse";
  }
  if (status === "Expired") {
    s = "bg-red-500/10 text-red-500";
  }
  return s;
}

export function MembersView() {
  const [memberFilterTab, setMemberFilterTab] = useState<FilterTab>("all");
  const displayMembers = filterMembers(members, memberFilterTab);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border flex justify-between items-center">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setMemberFilterTab("all")}
            className={`text-sm font-bold pb-2 transition border-b-2 ${
              memberFilterTab === "all"
                ? "border-sweat text-sweat"
                : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            All Data Member
          </button>
          <button
            type="button"
            onClick={() => setMemberFilterTab("active")}
            className={`text-sm font-bold pb-2 transition border-b-2 ${
              memberFilterTab === "active"
                ? "border-sweat text-sweat"
                : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            Active Member
          </button>
        </div>

        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search member name..."
            className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm w-64 focus:outline-none focus:border-sweat"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
            >
              <i className="fas fa-filter mr-2" aria-hidden />
              Filter
            </button>
            <button
              type="button"
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
            >
              <i className="fas fa-file-export mr-2" aria-hidden />
              Export CSV
            </button>
          </div>
        </div>
      </div>
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
          <tr>
            <th className="px-6 py-4">ID</th>
            <th className="px-6 py-4">Member Name</th>
            <th className="px-6 py-4">Current Plan</th>
            <th className="px-6 py-4">Home Club</th>
            <th className="px-6 py-4">Credits</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Payment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {displayMembers.map((m) => (
            <tr key={m.id} className="table-row transition">
              <td className="px-6 py-4 font-mono text-xs">{m.id}</td>
              <td className="px-6 py-4 font-bold text-white">
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden inline-block shrink-0">
                    <Image
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`}
                      alt=""
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </span>
                  {m.name}
                </span>
              </td>
              <td className="px-6 py-4">{m.plan}</td>
              <td className="px-6 py-4">{m.club}</td>
              <td className="px-6 py-4 font-bold text-sweat">{m.credits}</td>
              <td className="px-6 py-4">
                <span
                  className={`px-3 py-1 rounded text-xs font-bold ${statusStyle(m.status)}`}
                >
                  {m.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    m.payment === "Paid"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-yellow-500/10 text-yellow-500"
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
  );
}
