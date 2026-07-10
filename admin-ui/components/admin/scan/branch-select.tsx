"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

export type ScanBranch = {
  id: string;
  branchName: string;
  isActive: boolean;
};

const STORAGE_KEY = "sb_admin_scan_branch";

type Props = {
  value: string;
  onChange: (branchId: string) => void;
  disabled?: boolean;
};

export function BranchSelect({ value, onChange, disabled }: Props) {
  const [branches, setBranches] = useState<ScanBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/branches`, {
          cache: "no-store",
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const payload = (await res.json().catch(() => [])) as
          | ScanBranch[]
          | { data?: ScanBranch[]; items?: ScanBranch[] };
        const list = Array.isArray(payload)
          ? payload
          : payload.data ?? payload.items ?? [];
        if (!mounted) return;
        const active = Array.isArray(list) ? list.filter((b) => b.isActive) : [];
        setBranches(active);

        if (active.length > 0) {
          let chosen = "";
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && active.some((b) => b.id === saved)) chosen = saved;
          } catch {
            // ignore
          }
          if (!chosen) chosen = active[0].id;
          onChange(chosen);
        }
      } catch {
        // silently fail
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [onChange]);

  function handleSelect(id: string) {
    onChange(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  return (
    <select
      value={value}
      onChange={(e) => handleSelect(e.target.value)}
      disabled={disabled || loading || branches.length === 0}
      className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat disabled:opacity-60"
      aria-label="Active branch"
    >
      {loading && <option value="">Loading branches…</option>}
      {!loading && branches.length === 0 && <option value="">No active branches</option>}
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.branchName || b.id}
        </option>
      ))}
    </select>
  );
}
