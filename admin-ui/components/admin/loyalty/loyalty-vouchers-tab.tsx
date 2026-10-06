"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Field, FormError, inputClass } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { branchLabel, listBranches, type Branch } from "@/lib/api/branches";
import { ApiError, errorMessageOf } from "@/lib/api/http";
import {
  LOYALTY_VOUCHER_STATUSES,
  getLoyaltyVoucher,
  listLoyaltyVouchers,
  redeemLoyaltyVoucher,
  type LoyaltyVoucher,
} from "@/lib/api/loyalty";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { formatCurrency } from "@/lib/format";
import { jakartaDate, jakartaDateTime } from "@/lib/jakarta-time";
import { SearchBox } from "./search-box";

const PAGE_SIZE = 20;
const COLUMNS = 8;

const STATUS_TONE: Record<string, BadgeTone> = {
  Issued: "success",
  Used: "neutral",
  Expired: "danger",
  Cancelled: "warning",
};

/** Issued vouchers and redemption at the counter. */
export function LoyaltyVouchersTab() {
  const [rows, setRows] = useState<LoyaltyVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await listLoyaltyVouchers({
        page,
        pageSize: PAGE_SIZE,
        search,
        status: status || undefined,
      });
      setRows(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setError(null);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to load vouchers"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-6">
      <RedeemAtCounter branches={branches} onUsed={() => setRefreshKey((k) => k + 1)} />

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <SearchBox
            placeholder="Search code / member..."
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="bg-sidebar border border-border text-fg text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sweat"
          >
            <option value="">All statuses</option>
            {LOYALTY_VOUCHER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm text-muted">
              <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Reward</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Expires / Used</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <LoadingState colSpan={COLUMNS} />
                ) : error ? (
                  <ErrorState
                    colSpan={COLUMNS}
                    message={error}
                    onRetry={() => {
                      setLoading(true);
                      void load();
                    }}
                  />
                ) : rows.length === 0 ? (
                  <EmptyState colSpan={COLUMNS} icon="fa-ticket" title="No vouchers found" />
                ) : (
                  rows.map((v) => (
                    <tr key={v.id} className="hover:bg-fg/5 transition">
                      <td className="px-4 py-3 font-mono text-xs text-accent-ink font-bold">{v.voucherCode}</td>
                      <td className="px-4 py-3">
                        <p className="text-fg">{v.memberName || "—"}</p>
                        <p className="font-mono text-[11px] text-accent-ink">{v.memberCode}</p>
                      </td>
                      <td className="px-4 py-3 text-fg">
                        {v.rewardName}
                        <p className="text-[11px] text-muted">{v.pointsSpent} points</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-fg">{formatCurrency(v.voucherAmount)}</td>
                      <td className="px-4 py-3 text-fg">{v.branchName || "All branches"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{jakartaDate(v.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {v.usedAt ? (
                          <>
                            Used {jakartaDateTime(v.usedAt)}
                            {v.usedReference ? (
                              <p className="text-[11px] font-mono">{v.usedReference}</p>
                            ) : null}
                          </>
                        ) : v.expiresAt ? (
                          jakartaDate(v.expiresAt)
                        ) : (
                          "No expiry"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[v.status] ?? "neutral"}>{v.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            loading={loading}
            onChange={(next) => {
              setLoading(true);
              setPage(next);
            }}
            label="vouchers"
          />
        </div>
      </div>
    </div>
  );
}

/** Look a voucher up by code and mark it used (`POST /vouchers/{code}/use`). */
function RedeemAtCounter({
  branches,
  onUsed,
}: {
  branches: Branch[];
  onUsed: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [voucher, setVoucher] = useState<LoyaltyVoucher | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [using, setUsing] = useState(false);
  const [useError, setUseError] = useState<string | null>(null);

  async function lookup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || looking) return;
    setLooking(true);
    setLookupError(null);
    setUseError(null);
    setVoucher(null);
    try {
      const found = await getLoyaltyVoucher(trimmed);
      setVoucher(found);
      setBranchId(found.branchId ?? "");
      setAmount(0);
      setReference("");
    } catch (err) {
      setLookupError(
        err instanceof ApiError && err.status === 404
          ? `No voucher with code "${trimmed}".`
          : errorMessageOf(err, "Failed to look up the voucher")
      );
    } finally {
      setLooking(false);
    }
  }

  async function markUsed(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!voucher || using) return;
    setUsing(true);
    setUseError(null);
    try {
      const used = await redeemLoyaltyVoucher(voucher.voucherCode, {
        branchId: branchId || null,
        transactionAmount: amount > 0 ? amount : null,
        reference: reference.trim(),
      });
      setVoucher(used);
      toast.success("Voucher redeemed", `${used.voucherCode} · ${formatCurrency(used.voucherAmount)}`);
      onUsed();
    } catch (err) {
      setUseError(errorMessageOf(err, "Failed to redeem the voucher"));
    } finally {
      setUsing(false);
    }
  }

  const usable = voucher?.status === "Issued";

  return (
    <div className="rounded-xl border border-border bg-sidebar/40 p-4">
      <h3 className="font-display uppercase font-bold text-fg mb-3">
        <i className="fas fa-cash-register text-accent-ink mr-2" aria-hidden />
        Redeem at counter
      </h3>
      <form onSubmit={lookup} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Voucher code, e.g. SBX-AB12CD34"
          aria-label="Voucher code"
          className={`${inputClass()} font-mono sm:max-w-sm`}
        />
        <button
          type="submit"
          disabled={!code.trim() || looking}
          className="bg-sweat text-black font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          <i className={`fas ${looking ? "fa-circle-notch fa-spin" : "fa-magnifying-glass"}`} aria-hidden />
          Look up
        </button>
      </form>
      {lookupError ? <p className="text-sm text-danger mt-2">{lookupError}</p> : null}

      {voucher ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <dl className="rounded-lg border border-border bg-card p-4 text-sm grid grid-cols-2 gap-y-2 gap-x-4">
            <dt className="text-muted">Code</dt>
            <dd className="font-mono font-bold text-accent-ink">{voucher.voucherCode}</dd>
            <dt className="text-muted">Status</dt>
            <dd>
              <Badge tone={STATUS_TONE[voucher.status] ?? "neutral"}>{voucher.status}</Badge>
            </dd>
            <dt className="text-muted">Customer</dt>
            <dd className="text-fg">
              {voucher.memberName}{" "}
              <span className="font-mono text-[11px] text-accent-ink">{voucher.memberCode}</span>
            </dd>
            <dt className="text-muted">Reward</dt>
            <dd className="text-fg">{voucher.rewardName}</dd>
            <dt className="text-muted">Amount</dt>
            <dd className="text-fg font-bold">{formatCurrency(voucher.voucherAmount)}</dd>
            <dt className="text-muted">Valid at</dt>
            <dd className="text-fg">{voucher.branchName || "All branches"}</dd>
            <dt className="text-muted">Min. transaction</dt>
            <dd className="text-fg">
              {voucher.minimumTransaction > 0 ? formatCurrency(voucher.minimumTransaction) : "None"}
            </dd>
            <dt className="text-muted">Expires</dt>
            <dd className="text-fg">{voucher.expiresAt ? jakartaDate(voucher.expiresAt) : "No expiry"}</dd>
            {voucher.usedAt ? (
              <>
                <dt className="text-muted">Used</dt>
                <dd className="text-fg">
                  {jakartaDateTime(voucher.usedAt)}
                  {voucher.usedReference ? ` · ${voucher.usedReference}` : ""}
                </dd>
              </>
            ) : null}
          </dl>

          {usable ? (
            <form onSubmit={markUsed} className="space-y-3">
              <Field label="Branch" htmlFor="rv-branch">
                <select
                  id="rv-branch"
                  className={inputClass()}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">Not specified</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {branchLabel(b)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Transaction amount"
                htmlFor="rv-amount"
                hint={
                  voucher.minimumTransaction > 0
                    ? `Must be at least ${formatCurrency(voucher.minimumTransaction)}.`
                    : "Optional."
                }
              >
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
                  <input
                    id="rv-amount"
                    type="text"
                    inputMode="numeric"
                    className={`${inputClass()} pl-11`}
                    value={formatCurrencyInput(amount)}
                    onChange={(e) => setAmount(parseCurrencyInput(e.target.value))}
                  />
                </div>
              </Field>
              <Field label="Reference" htmlFor="rv-reference" hint="Invoice or POS reference.">
                <input
                  id="rv-reference"
                  type="text"
                  maxLength={100}
                  className={inputClass()}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
              <FormError message={useError} />
              <button
                type="submit"
                disabled={using}
                className="w-full bg-sweat text-black font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                <i className={`fas ${using ? "fa-circle-notch fa-spin" : "fa-check"}`} aria-hidden />
                Mark as used
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted self-center">
              This voucher is {voucher.status.toLowerCase()} and cannot be used.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
