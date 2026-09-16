"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FIELD_CLASS } from "@/components/ui/field";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PanelCard,
} from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { apiRequest, errorMessage, openPdf } from "@/lib/api/client";
import { useRole } from "@/contexts/role-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Branch } from "@/lib/branches";
import {
  COUNTER_PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  paymentStatusTone,
  type Payment,
} from "@/lib/payments";

/**
 * Payments and their invoices.
 *
 * Every PDF here is rendered by the backend from the payment record — the same
 * projection the printed and emailed receipt uses, so the letterhead matches
 * everywhere. Nothing is generated in the browser.
 */

const COLUMNS = 7;

const STATUS_OPTIONS = [
  { value: "1", label: "Paid" },
  { value: "0", label: "Pending" },
  { value: "2", label: "Failed" },
  { value: "3", label: "Expired" },
  { value: "4", label: "Refunded" },
  { value: "5", label: "Cancelled" },
];

export function InvoicesView() {
  const toast = useToast();
  const { can } = useRole();
  const canRead = can("payment.read");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Payment[]>("/api/payments", {
        query: {
          search,
          branchId,
          paymentStatus: status,
          paymentMethod: method,
          // Date-only bounds; the API compares them against created-at.
          from: from ? `${from}T00:00:00` : "",
          to: to ? `${to}T23:59:59` : "",
        },
      });
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(errorMessage(err));
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, canRead, from, method, search, status, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const data = await apiRequest<Branch[]>("/api/branches");
        setBranches(Array.isArray(data) ? data : []);
      } catch {
        setBranches([]);
      }
    }
    void loadBranches();
  }, []);

  const total = useMemo(
    () =>
      payments
        .filter((payment) => payment.paymentStatus === 1)
        .reduce((sum, payment) => sum + (payment.finalAmount ?? 0), 0),
    [payments]
  );

  async function invoice(payment: Payment, mode: "view" | "download") {
    setBusyId(payment.id);
    try {
      await openPdf(
        `/api/payments/${payment.id}/invoice/pdf`,
        mode,
        `${payment.invoiceNo || "Invoice"}.pdf`
      );
    } catch (err) {
      toast.error("Could not open the invoice", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function sendReceipt(payment: Payment) {
    setBusyId(payment.id);
    try {
      await apiRequest(`/api/payments/${payment.id}/receipt/email`, {
        method: "POST",
        body: {},
      });
      toast.success("Receipt emailed to the member.");
    } catch (err) {
      toast.error("Could not send the receipt", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!canRead) {
    return (
      <PanelCard>
        <div className="p-8 sm:p-12 text-center">
          <i className="fas fa-lock text-red-500 text-4xl mb-4" aria-hidden />
          <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
          <p className="text-sm text-gray-400">
            Your role does not have permission to view payments and invoices.
          </p>
        </div>
      </PanelCard>
    );
  }

  return (
    <div className="space-y-4">
      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold font-display uppercase text-white">
                Payments &amp; Invoices
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Invoice PDFs are rendered by the backend with the configured
                letterhead.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Paid in view
              </p>
              <p className="text-xl font-bold text-sweat">
                {formatCurrency(total)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative sm:col-span-2 xl:col-span-2">
              <i
                className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                aria-hidden
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Invoice no, member, plan or slip reference"
                aria-label="Search payments"
                className={`${FIELD_CLASS} !py-2 !pl-9 text-sm`}
              />
            </div>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Filter by branch"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branchName}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              aria-label="Filter by payment method"
              className={`${FIELD_CLASS} !py-2 text-sm`}
            >
              <option value="">All methods</option>
              {COUNTER_PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Payments from date"
                className={`${FIELD_CLASS} !py-2 !px-2 text-xs`}
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Payments to date"
                className={`${FIELD_CLASS} !py-2 !px-2 text-xs`}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm text-gray-400">
            <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
              <tr>
                <th className="px-6 py-4">Invoice</th>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Invoice PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <LoadingState colSpan={COLUMNS} />
              ) : error ? (
                <ErrorState
                  colSpan={COLUMNS}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : payments.length === 0 ? (
                <EmptyState
                  colSpan={COLUMNS}
                  icon="fa-receipt"
                  title="No payments found"
                  description="Widen the date range or clear the filters."
                />
              ) : (
                payments.map((payment) => {
                  const busy = busyId === payment.id;
                  return (
                    <tr key={payment.id} className="table-row transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="block text-white font-bold">
                          {payment.invoiceNo}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {formatDateTime(payment.created)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white">
                        {payment.memberName || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="block text-xs text-white">
                          {payment.membershipPlanName || "-"}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {payment.branchName || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="block text-white font-bold">
                          {formatCurrency(payment.finalAmount)}
                        </span>
                        {payment.discount > 0 ? (
                          <span className="block text-xs text-sweat">
                            −{formatCurrency(payment.discount)} discount
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {PAYMENT_METHOD_LABEL[payment.paymentMethod] ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={paymentStatusTone(payment.paymentStatus)}>
                          {PAYMENT_STATUS_LABEL[payment.paymentStatus] ??
                            "Unknown"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void invoice(payment, "view")}
                            disabled={busy}
                            className="text-gray-400 hover:text-white px-2 py-1 disabled:opacity-40"
                            aria-label={`View invoice ${payment.invoiceNo}`}
                            title="View invoice PDF"
                          >
                            <i
                              className={`fas ${busy ? "fa-circle-notch fa-spin" : "fa-file-pdf"}`}
                              aria-hidden
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => void invoice(payment, "download")}
                            disabled={busy}
                            className="text-gray-400 hover:text-white px-2 py-1 disabled:opacity-40"
                            aria-label={`Download invoice ${payment.invoiceNo}`}
                            title="Download invoice PDF"
                          >
                            <i className="fas fa-download" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendReceipt(payment)}
                            disabled={busy}
                            className="text-gray-400 hover:text-white px-2 py-1 disabled:opacity-40"
                            aria-label={`Email receipt for ${payment.invoiceNo}`}
                            title="Email receipt to the member"
                          >
                            <i className="fas fa-envelope" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}
