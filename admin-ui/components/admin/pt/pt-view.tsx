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
          <h1 className="text-2xl font-display font-bold text-fg uppercase tracking-wide">
            Personal Training
          </h1>
          <p className="text-sm text-muted mt-1">
            Manage PT Packages and PT Sessions
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("package")}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
            tab === "package"
              ? "border-sweat text-accent-ink"
              : "border-transparent text-muted hover:text-fg"
          }`}
        >
          PT Package
        </button>
        <button
          type="button"
          onClick={() => setTab("session")}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
            tab === "session"
              ? "border-sweat text-accent-ink"
              : "border-transparent text-muted hover:text-fg"
          }`}
        >
          PT Session
        </button>
      </div>

      {tab === "package" ? <PtPackageTab /> : <PtSessionTab />}
    </div>
  );
}
