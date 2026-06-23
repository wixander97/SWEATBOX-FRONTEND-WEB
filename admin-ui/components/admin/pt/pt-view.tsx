"use client";

import { useState } from "react";

import { PtPackageTab } from "@/components/admin/pt/pt-package-tab";
import { PtSessionTab } from "@/components/admin/pt/pt-session-tab";

type PtTab = "package" | "session";

export function PtView() {
  const [tab, setTab] = useState<PtTab>("package");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            Personal Training
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola PT Package dan PT Session
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("package")}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
            tab === "package"
              ? "border-sweat text-sweat"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          PT Package
        </button>
        <button
          type="button"
          onClick={() => setTab("session")}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
            tab === "session"
              ? "border-sweat text-sweat"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          PT Session
        </button>
      </div>

      {tab === "package" ? <PtPackageTab /> : <PtSessionTab />}
    </div>
  );
}
