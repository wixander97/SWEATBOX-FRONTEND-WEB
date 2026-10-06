"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Field, FormError, InfoNote, ToggleRow, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/contexts/role-context";
import { branchLabel, listBranches, type Branch } from "@/lib/api/branches";
import {
  PAYMENT_CATEGORY_OPTIONS,
  getFirstTransactionSettings,
  updateFirstTransactionSettings,
  type DiscountType,
  type FirstTransactionDiscountSettings,
} from "@/lib/api/customer-benefits";
import { errorMessageOf } from "@/lib/api/http";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { formatCurrency } from "@/lib/format";
import {
  DateRangeFields,
  ProgramStatusPill,
  ReasonField,
  SettingsLoadError,
  SettingsLoading,
  settingDate,
} from "./benefit-shared";
import { SettingsHistory } from "./settings-history";

type FormState = {
  isEnabled: boolean;
  discountType: DiscountType;
  amount: number;
  minimumTransaction: number;
  maximumDiscount: number | null;
  startDate: string;
  endDate: string;
  noEnd: boolean;
  branchIds: string[];
  paymentCategories: number[];
};

function toForm(s: FirstTransactionDiscountSettings): FormState {
  const end = settingDate(s.endDate);
  return {
    isEnabled: s.isEnabled,
    discountType: s.discountType === "Percent" ? "Percent" : "Fixed",
    amount: Number(s.amount) || 0,
    minimumTransaction: Number(s.minimumTransaction) || 0,
    maximumDiscount: s.maximumDiscount && s.maximumDiscount > 0 ? Number(s.maximumDiscount) : null,
    startDate: settingDate(s.startDate),
    endDate: end,
    noEnd: !end,
    branchIds: (s.branchIds ?? []).map((id) => id.toLowerCase()),
    paymentCategories: [...(s.paymentCategories ?? [])],
  };
}

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? (list.includes(value) ? list : [...list, value]) : list.filter((v) => v !== value);
}

/**
 * First transaction discount configuration
 * (`GET/PUT /api/v1/customer-benefits/first-transaction-discount/settings`).
 */
export function FirstTransactionTab() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("loyalty.write");

  const [saved, setSaved] = useState<FirstTransactionDiscountSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const settings = await getFirstTransactionSettings();
      setSaved(settings);
      setForm(toForm(settings));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessageOf(err, "Failed to load first transaction discount settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    listBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [load]);

  const branchNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of branches) map[b.id.toLowerCase()] = branchLabel(b);
    return map;
  }, [branches]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || saving) return;

    if (!(form.amount > 0)) {
      setError("The discount amount must be greater than zero.");
      return;
    }
    if (form.discountType === "Percent" && form.amount > 100) {
      setError("A percentage discount cannot exceed 100%.");
      return;
    }
    if (form.minimumTransaction < 0) {
      setError("Minimum transaction cannot be negative.");
      return;
    }
    const end = form.noEnd ? "" : form.endDate;
    if (!form.noEnd && !end) {
      setError("Pick an end date, or tick \"No end date\".");
      return;
    }
    if (form.startDate && end && end < form.startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }
    if (!reason.trim()) {
      setReasonError("Please give a reason for this change.");
      setError(null);
      return;
    }

    setError(null);
    setReasonError(null);
    setSaving(true);
    try {
      const result = await updateFirstTransactionSettings({
        isEnabled: form.isEnabled,
        discountType: form.discountType,
        amount: form.amount,
        minimumTransaction: form.minimumTransaction,
        maximumDiscount: form.maximumDiscount && form.maximumDiscount > 0 ? form.maximumDiscount : null,
        startDate: form.startDate || null,
        endDate: end || null,
        branchIds: form.branchIds,
        paymentCategories: [...form.paymentCategories].sort((a, b) => a - b),
        reason: reason.trim(),
      });
      setSaved(result);
      setForm(toForm(result));
      setReason("");
      setHistoryKey((k) => k + 1);
      toast.success("First transaction discount saved");
    } catch (err) {
      setError(errorMessageOf(err, "Failed to save first transaction discount settings"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SettingsLoading />;

  if (loadError || !form || !saved) {
    return (
      <SettingsLoadError
        message={loadError ?? "Failed to load first transaction discount settings"}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      />
    );
  }

  const disabled = !canWrite;
  const isPercent = form.discountType === "Percent";

  return (
    <div>
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display uppercase font-bold text-fg">First transaction discount</h3>
          <ProgramStatusPill
            isEnabled={saved.isEnabled}
            isActiveNow={saved.isActiveNow}
            startDate={saved.startDate}
            endDate={saved.endDate}
          />
        </div>

        <InfoNote>
          Applied automatically by the backend to a customer&apos;s first eligible paid
          transaction. Failed/cancelled payments don&apos;t use it up. Changes apply to new
          transactions only.
        </InfoNote>

        <ToggleRow
          id="ftd-enabled"
          label="Status"
          description={form.isEnabled ? "On — new customers get the discount." : "Off — no discount is given."}
          checked={form.isEnabled}
          disabled={disabled}
          onChange={(v) => set("isEnabled", v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Discount type" htmlFor="ftd-type">
            <select
              id="ftd-type"
              disabled={disabled}
              className={inputClass()}
              value={form.discountType}
              onChange={(e) => {
                const next = e.target.value === "Percent" ? "Percent" : "Fixed";
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        discountType: next,
                        amount:
                          next === "Percent" && prev.amount > 100 ? 10 : prev.amount,
                      }
                    : prev
                );
              }}
            >
              <option value="Fixed">Fixed amount</option>
              <option value="Percent">Percentage</option>
            </select>
          </Field>

          <Field
            label={isPercent ? "Discount (%)" : "Discount amount"}
            htmlFor="ftd-amount"
            required
            hint={isPercent ? "1–100% of the transaction." : undefined}
          >
            {isPercent ? (
              <div className="relative">
                <input
                  id="ftd-amount"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  inputMode="decimal"
                  disabled={disabled}
                  className={`${inputClass()} pr-10`}
                  value={Number.isFinite(form.amount) ? form.amount : ""}
                  onChange={(e) => set("amount", Number(e.target.value))}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
              </div>
            ) : (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
                <input
                  id="ftd-amount"
                  type="text"
                  inputMode="numeric"
                  disabled={disabled}
                  className={`${inputClass()} pl-11`}
                  value={formatCurrencyInput(form.amount)}
                  onChange={(e) => set("amount", parseCurrencyInput(e.target.value))}
                />
              </div>
            )}
          </Field>

          <Field
            label="Minimum transaction"
            htmlFor="ftd-min"
            hint="Rp 0 = no minimum."
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
              <input
                id="ftd-min"
                type="text"
                inputMode="numeric"
                disabled={disabled}
                className={`${inputClass()} pl-11`}
                value={formatCurrencyInput(form.minimumTransaction)}
                onChange={(e) => set("minimumTransaction", parseCurrencyInput(e.target.value))}
              />
            </div>
          </Field>

          <Field
            label="Maximum discount"
            htmlFor="ftd-max"
            hint="Optional cap — mainly for percentage discounts. Empty = no cap."
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
              <input
                id="ftd-max"
                type="text"
                inputMode="numeric"
                disabled={disabled}
                placeholder="No cap"
                className={`${inputClass()} pl-11`}
                value={form.maximumDiscount ? formatCurrencyInput(form.maximumDiscount) : ""}
                onChange={(e) => {
                  const n = parseCurrencyInput(e.target.value);
                  set("maximumDiscount", n > 0 ? n : null);
                }}
              />
            </div>
          </Field>
        </div>

        <DateRangeFields
          idPrefix="ftd"
          startLabel="Effective from"
          endLabel="Effective until"
          start={form.startDate}
          end={form.endDate}
          noEnd={form.noEnd}
          disabled={disabled}
          onStart={(v) => set("startDate", v)}
          onEnd={(v) => set("endDate", v)}
          onNoEnd={(v) => set("noEnd", v)}
        />

        <fieldset>
          <legend className="block text-muted text-sm mb-1">Applicable branches</legend>
          <p className="text-xs text-muted mb-2">None ticked = all branches.</p>
          {branches.length === 0 ? (
            <p className="text-xs text-muted">No branches loaded.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => {
                const id = b.id.toLowerCase();
                const checked = form.branchIds.includes(id);
                return (
                  <label
                    key={b.id}
                    className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
                      checked ? "border-sweat/50 bg-sweat/10 text-fg" : "border-border bg-sidebar text-muted"
                    } ${disabled ? "opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => set("branchIds", toggle(form.branchIds, id, e.target.checked))}
                      className="w-4 h-4 accent-[#ffd700]"
                    />
                    {branchLabel(b)}
                  </label>
                );
              })}
            </div>
          )}
          {/* Branches saved earlier that are no longer listed (e.g. deactivated). */}
          {form.branchIds.filter((id) => !branchNames[id]).length > 0 && branches.length > 0 ? (
            <p className="text-xs text-warning mt-2">
              Also includes {form.branchIds.filter((id) => !branchNames[id]).length} inactive or
              unknown branch(es).
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="block text-muted text-sm mb-1">Applicable categories</legend>
          <p className="text-xs text-muted mb-2">None ticked = all categories.</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_CATEGORY_OPTIONS.map((c) => {
              const checked = form.paymentCategories.includes(c.value);
              return (
                <label
                  key={c.value}
                  className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
                    checked ? "border-sweat/50 bg-sweat/10 text-fg" : "border-border bg-sidebar text-muted"
                  } ${disabled ? "opacity-60" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) =>
                      set("paymentCategories", toggle(form.paymentCategories, c.value, e.target.checked))
                    }
                    className="w-4 h-4 accent-[#ffd700]"
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <p className="text-xs text-muted">
          Currently saved:{" "}
          <span className="text-fg">
            {saved.discountType === "Percent"
              ? `${saved.amount}% off${saved.maximumDiscount ? ` (max ${formatCurrency(saved.maximumDiscount)})` : ""}`
              : `${formatCurrency(saved.amount)} off`}
            {saved.minimumTransaction > 0
              ? ` on transactions from ${formatCurrency(saved.minimumTransaction)}`
              : ""}
          </span>
        </p>

        {canWrite ? (
          <>
            <ReasonField
              id="ftd-reason"
              value={reason}
              error={reasonError}
              onChange={(v) => {
                setReason(v);
                if (v.trim()) setReasonError(null);
              }}
            />
            <FormError message={error} />
            <div className="flex justify-end">
              <SubmitButton submitting={saving}>
                <i className="fas fa-save" aria-hidden />
                Save Settings
              </SubmitButton>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">Only Admin and Super Admin can change these settings.</p>
        )}
      </form>

      <SettingsHistory area="FirstTransactionDiscount" refreshKey={historyKey} branchNames={branchNames} />
    </div>
  );
}
