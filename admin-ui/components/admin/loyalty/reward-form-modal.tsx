"use client";

import { useState, type FormEvent } from "react";
import { Field, FormError, InfoNote, ToggleRow, inputClass } from "@/components/ui/field";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import { branchLabel, type Branch } from "@/lib/api/branches";
import { errorMessageOf } from "@/lib/api/http";
import {
  createLoyaltyReward,
  updateLoyaltyReward,
  type LoyaltyReward,
  type LoyaltyRewardRequest,
} from "@/lib/api/loyalty";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { formatCurrency } from "@/lib/format";
import { jakartaDateInput, jakartaDayEndUtc, jakartaDayStartUtc } from "@/lib/jakarta-time";

type Props = {
  reward: LoyaltyReward | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: (reward: LoyaltyReward, created: boolean) => void;
};

type FormState = {
  name: string;
  description: string;
  voucherAmount: number;
  requiredPoints: string;
  voucherCodePrefix: string;
  voucherValidityDays: string;
  totalQuantity: string;
  perMemberLimit: string;
  branchId: string;
  minimumTransaction: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

function initialState(reward: LoyaltyReward | null): FormState {
  return {
    name: reward?.name ?? "",
    description: reward?.description ?? "",
    voucherAmount: reward?.voucherAmount ?? 0,
    requiredPoints: reward ? String(reward.requiredPoints) : "",
    voucherCodePrefix: reward?.voucherCodePrefix ?? "SBX",
    voucherValidityDays: reward?.voucherValidityDays != null ? String(reward.voucherValidityDays) : "",
    totalQuantity: reward?.totalQuantity != null ? String(reward.totalQuantity) : "",
    perMemberLimit: reward?.perMemberLimit != null ? String(reward.perMemberLimit) : "",
    branchId: reward?.branchId ?? "",
    minimumTransaction: reward?.minimumTransaction ?? 0,
    startDate: jakartaDateInput(reward?.startDate),
    endDate: jakartaDateInput(reward?.endDate),
    isActive: reward?.isActive ?? true,
  };
}

/** Empty -> null; otherwise a whole number, or NaN when it is not one. */
function optionalInt(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : Number.NaN;
}

/**
 * Create / edit a loyalty reward. Mounted only while open, so the form is
 * seeded from the reward directly.
 */
export function RewardFormModal({ reward, branches, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(reward));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const points = Number(form.requiredPoints);
  const pointValue =
    form.voucherAmount > 0 && Number.isFinite(points) && points > 0
      ? form.voucherAmount / points
      : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "A reward name is required.";
    if (!(form.voucherAmount > 0)) errors.voucherAmount = "Enter a voucher amount above zero.";
    if (!Number.isInteger(points) || points < 1) {
      errors.requiredPoints = "Required points must be a whole number of at least 1.";
    }
    const validity = optionalInt(form.voucherValidityDays);
    if (validity !== null && (Number.isNaN(validity) || validity < 1)) {
      errors.voucherValidityDays = "At least 1 day, or leave empty for no expiry.";
    }
    const quantity = optionalInt(form.totalQuantity);
    if (quantity !== null && (Number.isNaN(quantity) || quantity < 1)) {
      errors.totalQuantity = "At least 1, or leave empty for unlimited.";
    }
    const perMember = optionalInt(form.perMemberLimit);
    if (perMember !== null && (Number.isNaN(perMember) || perMember < 1)) {
      errors.perMemberLimit = "At least 1, or leave empty for no limit.";
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errors.endDate = "The end date cannot be before the start date.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Please correct the highlighted fields.");
      return;
    }

    const body: LoyaltyRewardRequest = {
      name: form.name.trim(),
      description: form.description.trim(),
      voucherAmount: form.voucherAmount,
      requiredPoints: points,
      voucherCodePrefix: form.voucherCodePrefix.trim().toUpperCase() || "SBX",
      voucherValidityDays: validity,
      totalQuantity: quantity,
      perMemberLimit: perMember,
      branchId: form.branchId || null,
      minimumTransaction: form.minimumTransaction,
      startDate: form.startDate ? jakartaDayStartUtc(form.startDate) : null,
      endDate: form.endDate ? jakartaDayEndUtc(form.endDate) : null,
      isActive: form.isActive,
    };

    setError(null);
    setSubmitting(true);
    try {
      const saved = reward
        ? await updateLoyaltyReward(reward.id, body)
        : await createLoyaltyReward(body);
      onSaved(saved, !reward);
      onClose();
    } catch (err) {
      setError(errorMessageOf(err, "Failed to save the reward"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      busy={submitting}
      title={reward ? "Edit Reward" : "New Reward"}
      subtitle="Members exchange points for a voucher worth a fixed amount."
    >
      <form id="loyalty-reward-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" htmlFor="lr-name" required error={fieldErrors.name}>
          <input
            id="lr-name"
            type="text"
            maxLength={120}
            className={inputClass(Boolean(fieldErrors.name))}
            placeholder="e.g. Rp 50.000 voucher"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <Field label="Description" htmlFor="lr-description">
          <textarea
            id="lr-description"
            rows={2}
            className={inputClass()}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Voucher amount" htmlFor="lr-amount" required error={fieldErrors.voucherAmount}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
              <input
                id="lr-amount"
                type="text"
                inputMode="numeric"
                className={`${inputClass(Boolean(fieldErrors.voucherAmount))} pl-11`}
                value={formatCurrencyInput(form.voucherAmount)}
                onChange={(e) => set("voucherAmount", parseCurrencyInput(e.target.value))}
              />
            </div>
          </Field>
          <Field
            label="Required points"
            htmlFor="lr-points"
            required
            error={fieldErrors.requiredPoints}
            hint={pointValue !== null ? `1 point = ${formatCurrency(pointValue)}` : undefined}
          >
            <input
              id="lr-points"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className={inputClass(Boolean(fieldErrors.requiredPoints))}
              value={form.requiredPoints}
              onChange={(e) => set("requiredPoints", e.target.value)}
            />
          </Field>

          <Field label="Voucher code prefix" htmlFor="lr-prefix" hint="Codes look like SBX-AB12CD34.">
            <input
              id="lr-prefix"
              type="text"
              maxLength={10}
              className={`${inputClass()} uppercase`}
              value={form.voucherCodePrefix}
              onChange={(e) => set("voucherCodePrefix", e.target.value)}
            />
          </Field>
          <Field
            label="Voucher validity (days)"
            htmlFor="lr-validity"
            error={fieldErrors.voucherValidityDays}
            hint="Empty = no expiry."
          >
            <input
              id="lr-validity"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className={inputClass(Boolean(fieldErrors.voucherValidityDays))}
              value={form.voucherValidityDays}
              onChange={(e) => set("voucherValidityDays", e.target.value)}
            />
          </Field>

          <Field
            label="Quantity"
            htmlFor="lr-quantity"
            error={fieldErrors.totalQuantity}
            hint="Total vouchers available. Empty = unlimited."
          >
            <input
              id="lr-quantity"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className={inputClass(Boolean(fieldErrors.totalQuantity))}
              value={form.totalQuantity}
              onChange={(e) => set("totalQuantity", e.target.value)}
            />
          </Field>
          <Field
            label="Per-member limit"
            htmlFor="lr-per-member"
            error={fieldErrors.perMemberLimit}
            hint="Empty = no limit."
          >
            <input
              id="lr-per-member"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className={inputClass(Boolean(fieldErrors.perMemberLimit))}
              value={form.perMemberLimit}
              onChange={(e) => set("perMemberLimit", e.target.value)}
            />
          </Field>

          <Field label="Branch" htmlFor="lr-branch" hint="Where the voucher can be used.">
            <select
              id="lr-branch"
              className={inputClass()}
              value={form.branchId}
              onChange={(e) => set("branchId", e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {branchLabel(b)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minimum transaction" htmlFor="lr-min" hint="Rp 0 = no minimum.">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
              <input
                id="lr-min"
                type="text"
                inputMode="numeric"
                className={`${inputClass()} pl-11`}
                value={formatCurrencyInput(form.minimumTransaction)}
                onChange={(e) => set("minimumTransaction", parseCurrencyInput(e.target.value))}
              />
            </div>
          </Field>

          <Field label="Start date" htmlFor="lr-start" hint="Empty = available now.">
            <input
              id="lr-start"
              type="date"
              className={inputClass()}
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>
          <Field label="End date" htmlFor="lr-end" error={fieldErrors.endDate} hint="Empty = no end date.">
            <input
              id="lr-end"
              type="date"
              min={form.startDate || undefined}
              className={inputClass(Boolean(fieldErrors.endDate))}
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>
        </div>

        <ToggleRow
          id="lr-active"
          label="Active"
          description="Inactive rewards are hidden from members. Vouchers already issued stay valid."
          checked={form.isActive}
          onChange={(v) => set("isActive", v)}
        />

        {pointValue !== null ? (
          <InfoNote>
            Members spend {points} point{points === 1 ? "" : "s"} for a{" "}
            {formatCurrency(form.voucherAmount)} voucher — 1 point = {formatCurrency(pointValue)}.
          </InfoNote>
        ) : null}

        <FormError message={error} />
      </form>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onClose} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <SubmitButton submitting={submitting} form="loyalty-reward-form">
          <i className="fas fa-save" aria-hidden />
          {reward ? "Save Changes" : "Create Reward"}
        </SubmitButton>
      </div>
    </Modal>
  );
}
