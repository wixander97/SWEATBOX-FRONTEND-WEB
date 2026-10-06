"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { InfoNote } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/contexts/role-context";
import { errorMessageOf } from "@/lib/api/http";
import { formatCurrency } from "@/lib/format";
import {
  DROP_IN_CATEGORY,
  dropInProductLabel,
  getDropInCatalogue,
  type DropInProduct,
} from "@/lib/api/drop-in";
import { DropInProductModal } from "./drop-in-product-modal";

type BranchGroup = { branchId: string; branchName: string; products: DropInProduct[] };

/** One Day Pass first, then Single Visit — the order the app offers them. */
function productRank(p: DropInProduct): number {
  return p.paymentCategory === DROP_IN_CATEGORY.dayPass ? 0 : 1;
}

export function DropInProductsTab() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("dropIn.write");

  const [products, setProducts] = useState<DropInProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DropInProduct | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getDropInCatalogue();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to load the drop-in catalogue"));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo<BranchGroup[]>(() => {
    const map = new Map<string, BranchGroup>();
    for (const p of products) {
      const group = map.get(p.branchId) ?? {
        branchId: p.branchId,
        branchName: p.branchName,
        products: [],
      };
      group.products.push(p);
      map.set(p.branchId, group);
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, products: [...g.products].sort((a, b) => productRank(a) - productRank(b)) }))
      .sort((a, b) => a.branchName.localeCompare(b.branchName));
  }, [products]);

  function handleSaved(saved: DropInProduct) {
    setProducts((prev) =>
      prev.map((p) =>
        p.branchId === saved.branchId && p.paymentCategory === saved.paymentCategory ? saved : p
      )
    );
    toast.success("Drop-in product saved", `${dropInProductLabel(saved)} · ${saved.branchName}`);
  }

  return (
    <div className="space-y-4">
      <InfoNote>
        <strong>One Day Pass</strong> = unlimited classes on the chosen day at that branch.{" "}
        <strong>Single Visit</strong> = one class. Both are valid only at the branch they are
        bought for.
      </InfoNote>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-muted text-sm py-10">
          <i className="fas fa-circle-notch fa-spin text-accent-ink" aria-hidden />
          Loading…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="text-xs text-fg bg-fg/5 hover:bg-fg/10 border border-border px-4 py-2 rounded-lg"
          >
            Try again
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">No active branches found.</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {groups.map((group) => (
            <div key={group.branchId} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-sidebar border-b border-border flex items-center gap-2">
                <i className="fas fa-location-dot text-accent-ink" aria-hidden />
                <h3 className="font-display uppercase font-bold text-fg">{group.branchName}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm text-muted">
                  <thead className="text-xs uppercase font-bold text-muted">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-center">Visits</th>
                      <th className="px-4 py-3 text-center">Validity</th>
                      <th className="px-4 py-3">Status</th>
                      {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.products.map((p) => (
                      <tr key={p.paymentCategory} className="hover:bg-fg/5 transition">
                        <td className="px-4 py-3">
                          <p className="font-bold text-fg">{dropInProductLabel(p)}</p>
                          <p className="text-[11px] text-muted">{p.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-fg">
                          {formatCurrency(p.price)}
                        </td>
                        <td className="px-4 py-3 text-center text-fg">
                          {p.isUnlimited ? "Unlimited" : (p.visits ?? 1)}
                        </td>
                        <td className="px-4 py-3 text-center text-fg">
                          {p.validityDays} {p.validityDays === 1 ? "day" : "days"}
                        </td>
                        <td className="px-4 py-3">
                          {p.isEnabled ? (
                            <Badge tone="success">On sale</Badge>
                          ) : (
                            <Badge tone="neutral">Off</Badge>
                          )}
                        </td>
                        {canWrite ? (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setEditing(p)}
                              className="bg-sweat text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-400 transition inline-flex items-center gap-1.5"
                            >
                              <i className="fas fa-edit" aria-hidden />
                              Edit
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <DropInProductModal
          key={`${editing.branchId}:${editing.paymentCategory}`}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
