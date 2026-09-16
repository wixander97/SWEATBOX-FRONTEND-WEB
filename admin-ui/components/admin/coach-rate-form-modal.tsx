"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import {
  Field,
  FormError,
  InfoNote,
  ToggleRow,
  inputClass,
} from "@/components/ui/field";
import { ApiError, errorMessage } from "@/lib/api/client";
import { toDateInput, dateToWire } from "@/lib/format";
import type { Branch } from "@/lib/branches";
import {
  RATE_TYPES,
  RATE_TYPE_LABEL,
  type CoachRateTier,
  type CoachRateTierRequest,
  type RateType,
} from "@/lib/coach-rates";

/**
 * Creating or editing one pay tier.
 *
 * The rate type is fixed once a tier exists: a coach tier and an assistant tier
 * are different ladders, and flipping an existing tier between them would
 * silently re-price every class already pointing at it.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  tier?: CoachRateTier | null;
  /** The ladder a newly created tier belongs to. */
  defaultRateType: RateType;
  branches: Branch[];
  onSubmit: (values: CoachRateTierRequest) => Promise<void>;
};

type FormState = {
  name: string;
  rateType: RateType;
  rate: string;
  branchId: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

function initialState(
  tier: CoachRateTier | null | undefined,
  defaultRateType: RateType
): FormState {
  return {
    name: tier?.name ?? "",
    rateType: (tier?.rateType as RateType) ?? defaultRateType,
    rate: tier ? String(tier.rate) : "",
    branchId: tier?.branchId ?? "",
    description: tier?.description ?? "",
    isActive: tier?.isActive ?? true,
    isDefault: tier?.isDefault ?? false,
    effectiveFrom: toDateInput(tier?.effectiveFrom),
    effectiveTo: toDateInput(tier?.effectiveTo),
  };
}

export function CoachRateFormModal({
  open,
  onClose,
  tier,
  defaultRateType,
  branches,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(tier, defaultRateType)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setForm(initialState(tier, defaultRateType));
    setError(null);
    setFieldErrors({});
  }, [open, tier, defaultRateType]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "A tier name is required.";
    const rate = Number(form.rate);
    if (!form.rate.trim() || Number.isNaN(rate) || rate < 0) {
      errors.rate = "Enter the rate as a number.";
    }
    if (
      form.effectiveFrom &&
      form.effectiveTo &&
      form.effectiveTo < form.effectiveFrom
    ) {
      errors.effectiveTo = "The end date cannot be before the start date.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Please correct the highlighted fields.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        rateType: form.rateType,
        rate,
        branchId: form.branchId || null,
        description: form.description.trim(),
        isActive: form.isActive,
        isDefault: form.isDefault,
        effectiveFrom: dateToWire(form.effectiveFrom),
        effectiveTo: dateToWire(form.effectiveTo),
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setFieldErrors(err.fieldErrors);
      }
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isAssistant = form.rateType === RATE_TYPES.assistant;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      title={tier ? "Edit Rate Tier" : `New ${RATE_TYPE_LABEL[form.rateType]}`}
      subtitle={
        isAssistant
          ? "Paid to an assistant coach on a class"
          : "Paid to the primary coach on a class"
      }
    >
      <form id="coach-rate-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" htmlFor="crf-name" required error={fieldErrors.name}>
          <input
            id="crf-name"
            type="text"
            className={inputClass(Boolean(fieldErrors.name))}
            placeholder={
              isAssistant ? "e.g. Assistant Standard" : "e.g. Head Coach Tier 1"
            }
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Rate per class (IDR)"
            htmlFor="crf-rate"
            required
            error={fieldErrors.rate}
          >
            <input
              id="crf-rate"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              className={inputClass(Boolean(fieldErrors.rate))}
              placeholder="e.g. 250000"
              value={form.rate}
              onChange={(e) => set("rate", e.target.value)}
            />
          </Field>

          <Field
            label="Branch"
            htmlFor="crf-branch"
            hint="Leave blank to make the tier available at every branch."
          >
            <select
              id="crf-branch"
              className={inputClass()}
              value={form.branchId}
              onChange={(e) => set("branchId", e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branchName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description" htmlFor="crf-description">
          <textarea
            id="crf-description"
            rows={3}
            className={inputClass()}
            placeholder="What this tier is for — seniority, class type, anything the payroll run should know."
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Effective From" htmlFor="crf-from">
            <input
              id="crf-from"
              type="date"
              className={inputClass()}
              value={form.effectiveFrom}
              onChange={(e) => set("effectiveFrom", e.target.value)}
            />
          </Field>
          <Field
            label="Effective To"
            htmlFor="crf-to"
            error={fieldErrors.effectiveTo}
          >
            <input
              id="crf-to"
              type="date"
              className={inputClass(Boolean(fieldErrors.effectiveTo))}
              value={form.effectiveTo}
              onChange={(e) => set("effectiveTo", e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <ToggleRow
            id="crf-active"
            label="Active"
            description="Inactive tiers stay on existing classes but cannot be picked for new ones."
            checked={form.isActive}
            onChange={(checked) => set("isActive", checked)}
          />
          <ToggleRow
            id="crf-default"
            label="Default for this branch"
            description="Used when a class does not name a tier for this seat."
            checked={form.isDefault}
            onChange={(checked) => set("isDefault", checked)}
          />
        </div>

        {tier ? (
          <InfoNote>
            The rate type cannot be changed after a tier exists — classes already
            pointing at it are paid on this ladder.
          </InfoNote>
        ) : null}

        <FormError message={error} />
      </form>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onClose} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <SubmitButton submitting={submitting} form="coach-rate-form">
          <i className="fas fa-save" aria-hidden />
          {tier ? "Save Changes" : "Create Tier"}
        </SubmitButton>
      </div>
    </Modal>
  );
}
