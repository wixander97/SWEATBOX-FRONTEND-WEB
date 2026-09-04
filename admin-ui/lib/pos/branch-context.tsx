"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { branchLabel, listBranches, type Branch } from "@/lib/api/branches";
import { errorMessageOf } from "@/lib/api/http";

/**
 * The branch the front desk is currently selling from.
 *
 * The list comes from `GET /api/v1/branches`, so the POS offers exactly the
 * branches that exist in the system — PIK2 and Kedoya today, and anything added
 * later without a frontend change. Nothing here is hardcoded.
 *
 * The branch matters beyond filtering the catalogue: AsteriPay resolves a
 * different merchant per branch, so selling a PIK2 plan under Kedoya would
 * settle against the wrong merchant account.
 */

const STORAGE_KEY = "sweatbox.pos.branchId";

type BranchContextValue = {
  branches: Branch[];
  branch: Branch | null;
  branchId: string;
  setBranchId: (id: string) => void;
  loading: boolean;
  error: string;
  reload: () => void;
};

const PosBranchContext = createContext<BranchContextValue | null>(null);

function readStoredBranchId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function PosBranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Preference only; the session still works without it.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    listBranches()
      .then((list) => {
        if (cancelled) return;
        setBranches(list);

        // Restore the last branch, but only while it still exists and is active;
        // otherwise fall back to the single branch, or make staff choose.
        const stored = readStoredBranchId();
        const restored = list.some((b) => b.id === stored) ? stored : "";
        const next = restored || (list.length === 1 ? list[0].id : "");
        setBranchIdState(next);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessageOf(err, "Failed to load branches"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const branch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? null,
    [branches, branchId]
  );

  const value = useMemo(
    () => ({
      branches,
      branch,
      branchId,
      setBranchId,
      loading,
      error,
      // Reload is an event, not an effect, so the pending state is set here.
      reload: () => {
        setLoading(true);
        setError("");
        setReloadKey((k) => k + 1);
      },
    }),
    [branches, branch, branchId, setBranchId, loading, error]
  );

  return (
    <PosBranchContext.Provider value={value}>{children}</PosBranchContext.Provider>
  );
}

export function usePosBranch(): BranchContextValue {
  const ctx = useContext(PosBranchContext);
  if (!ctx) {
    throw new Error("usePosBranch must be used inside PosBranchProvider");
  }
  return ctx;
}

export { branchLabel };
export type { Branch };
