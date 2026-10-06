"use client";

import { useState, type FormEvent } from "react";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import { Field, FormError, InfoNote, ToggleRow, inputClass } from "@/components/ui/field";
import { errorMessageOf } from "@/lib/api/http";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import {
  DROP_IN_CATEGORY,
  dropInProductLabel,
  updateDropInProduct,
  type DropInProduct,
} from "@/lib/api/drop-in";

type Props = {
  product: DropInProduct;
  onClose: () => void;
  onSaved: (product: DropInProduct) => void;
};

/**
 * Edits one drop-in product at one branch (`PUT /api/v1/drop-in/catalogue`).
 *
 * Mounted only while open, so the form state is seeded straight from the
 * product instead of being reset in an effect.
 */
export function DropInProductModal({ product, onClose, onSaved }: Props) {
  const isDayPass = product.paymentCategory === DROP_IN_CATEGORY.dayPass;
  const label = dropInProductLabel(product);

  const [price, setPrice] = useState<number>(product.price);
  // The One Day Pass is unlimited; a fixed visit count is an advanced option
  // kept only for branches that still sell the old N-visit pass.
  const [limitVisits, setLimitVisits] = useState<boolean>(isDayPass && !product.isUnlimited);
  const [visits, setVisits] = useState<string>(String(product.visits ?? 1));
  const [validityDays, setValidityDays] = useState<string>(String(product.validityDays || 1));
  const [isEnabled, setIsEnabled] = useState<boolean>(product.isEnabled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const errors: Record<string, string> = {};
    if (!(price > 0)) errors.price = "Enter a price above zero.";

    const validity = Number(validityDays);
    if (!Number.isInteger(validity) || validity < 1) {
      errors.validityDays = "Validity must be at least 1 day.";
    }

    const needsVisits = !isDayPass || limitVisits;
    const visitCount = Number(visits);
    if (needsVisits && (!Number.isInteger(visitCount) || visitCount < 1)) {
      errors.visits = "Visits must be a whole number of at least 1.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Please correct the highlighted fields.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const saved = await updateDropInProduct({
        branchId: product.branchId,
        paymentCategory: product.paymentCategory,
        price,
        visits: needsVisits ? visitCount : null,
        validityDays: validity,
        isEnabled,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorMessageOf(err, "Failed to save the drop-in product"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={submitting}
      title={`Edit ${label}`}
      subtitle={`Branch ${product.branchName}`}
    >
      <form id="drop-in-product-form" onSubmit={handleSubmit} className="space-y-4">
        <InfoNote>
          {isDayPass
            ? "One Day Pass = unlimited classes on the chosen day at this branch."
            : "Single Visit = one class at this branch."}{" "}
          Drop-in products are valid only at the branch they are bought for.
        </InfoNote>

        <Field label="Price" htmlFor="dip-price" required error={fieldErrors.price}>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
            <input
              id="dip-price"
              type="text"
              inputMode="numeric"
              className={`${inputClass(Boolean(fieldErrors.price))} pl-11`}
              value={formatCurrencyInput(price)}
              onChange={(e) => setPrice(parseCurrencyInput(e.target.value))}
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isDayPass && !limitVisits ? (
            <Field label="Visits" htmlFor="dip-visits" hint="Unlimited classes for the day.">
              <input
                id="dip-visits"
                type="text"
                className={inputClass()}
                value="Unlimited"
                disabled
                readOnly
              />
            </Field>
          ) : (
            <Field label="Visits" htmlFor="dip-visits" required error={fieldErrors.visits}>
              <input
                id="dip-visits"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                className={inputClass(Boolean(fieldErrors.visits))}
                value={visits}
                onChange={(e) => setVisits(e.target.value)}
              />
            </Field>
          )}

          <Field
            label="Validity (days)"
            htmlFor="dip-validity"
            required
            error={fieldErrors.validityDays}
            hint="Calendar days, counting the first."
          >
            <input
              id="dip-validity"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className={inputClass(Boolean(fieldErrors.validityDays))}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <ToggleRow
            id="dip-enabled"
            label="On sale"
            description="Off withdraws this product from the app and the POS at this branch."
            checked={isEnabled}
            onChange={setIsEnabled}
          />
          {isDayPass ? (
            <ToggleRow
              id="dip-limit"
              label="Advanced: limit the number of classes"
              description="Turns the pass into a fixed N-visit pass instead of unlimited. Leave off for the One Day Pass."
              checked={limitVisits}
              onChange={setLimitVisits}
            />
          ) : null}
        </div>

        <FormError message={error} />
      </form>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onClose} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <SubmitButton submitting={submitting} form="drop-in-product-form">
          <i className="fas fa-save" aria-hidden />
          Save Changes
        </SubmitButton>
      </div>
    </Modal>
  );
}
