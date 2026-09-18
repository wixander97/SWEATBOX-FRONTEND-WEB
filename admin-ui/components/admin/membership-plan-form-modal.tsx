"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import {
  Field,
  FormError,
  InfoNote,
  ToggleRow,
  inputClass,
  LABEL_CLASS,
} from "@/components/ui/field";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  dateToWire,
  formatCurrency,
  timeToWire,
  toDateInput,
  toTimeInput,
} from "@/lib/format";
import type { Branch } from "@/lib/branches";
import {
  MEMBERSHIP_TYPES,
  WEEKDAYS,
  isDiscountEligibleType,
  parseAccessDays,
  serializeAccessDays,
  type MembershipPlan,
  type MembershipPlanRequest,
} from "@/lib/membership-plans";

/**
 * Membership plan configuration.
 *
 * Every access rule set here is *enforced by the backend* — the Limited plan's
 * Monday–Friday 08:00–11:00 window, the last session that may start at 10:00,
 * the sales period, the member discount. This form exists so those rules have
 * somewhere to be configured and read back; nothing in the browser decides
 * whether a member may enter or whether a plan may be sold.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  plan?: MembershipPlan | null;
  branches: Branch[];
  onSubmit: (values: MembershipPlanRequest) => Promise<void>;
};

type FormState = {
  planName: string;
  branchId: string;
  membershipType: string;
  description: string;
  price: string;
  registrationFee: string;
  credits: string;
  validityDays: string;
  ptSessions: string;
  planCategory: string;

  isUnlimitedClasses: boolean;
  isPtIncluded: boolean;
  isPopular: boolean;
  allowMultiBranchAccess: boolean;
  allowsClassAccess: boolean;
  allowsOpenGymAccess: boolean;
  expiresAtEndOfDay: boolean;
  isActive: boolean;
  isAvailableForSale: boolean;

  accessDays: number[];
  accessStartTime: string;
  accessEndTime: string;
  lastSessionStartTime: string;

  salesStartDate: string;
  salesEndDate: string;
  memberDiscountPercent: string;
};

/** Readable IDR preview under a raw number input, e.g. `Rp 2.000.000`. */
function currencyHint(raw: string): string | undefined {
  const value = Number(raw);
  if (!raw.trim() || Number.isNaN(value) || value <= 0) return undefined;
  return formatCurrency(value);
}

function initialState(plan: MembershipPlan | null | undefined): FormState {
  return {
    planName: plan?.planName ?? "",
    branchId: plan?.branchId ?? "",
    membershipType: plan?.membershipType ?? "",
    description: plan?.description ?? "",
    price: plan ? String(plan.price) : "",
    registrationFee: plan ? String(plan.registrationFee ?? 0) : "0",
    credits: plan ? String(plan.credits) : "0",
    validityDays: plan ? String(plan.validityDays) : "",
    ptSessions: plan ? String(plan.ptSessions ?? 0) : "0",
    planCategory: plan?.planCategory ?? "",

    isUnlimitedClasses: plan?.isUnlimitedClasses ?? false,
    isPtIncluded: plan?.isPtIncluded ?? false,
    isPopular: plan?.isPopular ?? false,
    allowMultiBranchAccess: plan?.allowMultiBranchAccess ?? false,
    allowsClassAccess: plan?.allowsClassAccess ?? true,
    allowsOpenGymAccess: plan?.allowsOpenGymAccess ?? true,
    expiresAtEndOfDay: plan?.expiresAtEndOfDay ?? false,
    isActive: plan?.isActive ?? true,
    isAvailableForSale: plan?.isAvailableForSale ?? true,

    accessDays: parseAccessDays(plan?.accessDaysOfWeek),
    accessStartTime: toTimeInput(plan?.accessStartTime),
    accessEndTime: toTimeInput(plan?.accessEndTime),
    lastSessionStartTime: toTimeInput(plan?.lastSessionStartTime),

    salesStartDate: toDateInput(plan?.salesStartDate),
    salesEndDate: toDateInput(plan?.salesEndDate),
    memberDiscountPercent: plan ? String(plan.memberDiscountPercent ?? 0) : "0",
  };
}

/**
 * The shape each product usually takes, applied when the type is chosen on a
 * *new* plan.
 *
 * A starting point, not a rule: every value stays editable, and an existing
 * plan is never rewritten by changing its type. The authoritative behaviour is
 * the backend's; this only saves re-typing the obvious.
 */
const TYPE_DEFAULTS: Record<
  string,
  Partial<
    Pick<
      FormState,
      | "allowsClassAccess"
      | "allowsOpenGymAccess"
      | "expiresAtEndOfDay"
      | "validityDays"
      | "credits"
      | "isUnlimitedClasses"
      | "memberDiscountPercent"
      | "accessDays"
      | "accessStartTime"
      | "accessEndTime"
      | "lastSessionStartTime"
    >
  >
> = {
  Unlimited: {
    allowsClassAccess: true,
    allowsOpenGymAccess: true,
    isUnlimitedClasses: true,
    expiresAtEndOfDay: false,
    validityDays: "30",
  },
  OpenGym: {
    allowsClassAccess: false,
    allowsOpenGymAccess: true,
    isUnlimitedClasses: false,
    expiresAtEndOfDay: false,
    validityDays: "30",
  },
  DropIn: {
    allowsClassAccess: true,
    allowsOpenGymAccess: true,
    isUnlimitedClasses: false,
    expiresAtEndOfDay: false,
    credits: "1",
    validityDays: "1",
    memberDiscountPercent: "50",
  },
  DayPass: {
    allowsClassAccess: true,
    allowsOpenGymAccess: true,
    isUnlimitedClasses: false,
    // A day pass ends at midnight of the day it starts, not after a whole day.
    expiresAtEndOfDay: true,
    validityDays: "1",
    memberDiscountPercent: "50",
  },
  DropInPass: {
    allowsClassAccess: true,
    allowsOpenGymAccess: true,
    isUnlimitedClasses: false,
    credits: "5",
    validityDays: "30",
    memberDiscountPercent: "0",
  },
  WeekUnlimited: {
    allowsClassAccess: true,
    allowsOpenGymAccess: true,
    isUnlimitedClasses: true,
    validityDays: "7",
    memberDiscountPercent: "0",
  },
  Limited: {
    allowsClassAccess: true,
    allowsOpenGymAccess: true,
    isUnlimitedClasses: false,
    validityDays: "30",
    accessDays: [1, 2, 3, 4, 5],
    accessStartTime: "08:00",
    accessEndTime: "11:00",
    lastSessionStartTime: "10:00",
    memberDiscountPercent: "0",
  },
};

export function MembershipPlanFormModal({
  open,
  onClose,
  plan,
  branches,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(plan));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setForm(initialState(plan));
    setError(null);
    setFieldErrors({});
  }, [open, plan]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseType(membershipType: string) {
    setForm((prev) => {
      const next = { ...prev, membershipType };
      // Only a new plan is pre-filled; rewriting a live plan's access window
      // from a dropdown would be a surprising way to change who can get in.
      if (plan) return next;
      const defaults = TYPE_DEFAULTS[membershipType];
      return defaults ? { ...next, ...defaults } : next;
    });
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      accessDays: prev.accessDays.includes(day)
        ? prev.accessDays.filter((d) => d !== day)
        : [...prev.accessDays, day].sort((a, b) => a - b),
    }));
  }

  const discountEligible = isDiscountEligibleType(form.membershipType);

  const discountPreview = useMemo(() => {
    const price = Number(form.price);
    const percent = Number(form.memberDiscountPercent);
    if (!discountEligible || !price || !percent) return null;
    // Illustration only — the amount charged is always priced by the backend.
    return Math.round(price - (price * percent) / 100);
  }, [discountEligible, form.price, form.memberDiscountPercent]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const errors: Record<string, string> = {};
    if (!form.planName.trim()) errors.planName = "Plan name is required.";
    if (!form.branchId) errors.branchId = "Branch is required.";

    const price = Number(form.price);
    if (!form.price.trim() || Number.isNaN(price) || price <= 0) {
      errors.price = "Price must be greater than 0.";
    } else if (!Number.isInteger(price)) {
      errors.price = "Price must be a whole number.";
    }

    const registrationFee = Number(form.registrationFee);
    if (
      form.registrationFee.trim() &&
      (Number.isNaN(registrationFee) ||
        registrationFee < 0 ||
        !Number.isInteger(registrationFee))
    ) {
      errors.registrationFee =
        "Registration fee must be a whole number of 0 or more.";
    }

    const validityDays = Number(form.validityDays);
    if (
      !form.validityDays.trim() ||
      Number.isNaN(validityDays) ||
      validityDays <= 0
    ) {
      errors.validityDays = "Validity days must be greater than 0.";
    } else if (!Number.isInteger(validityDays)) {
      errors.validityDays = "Validity days must be a whole number.";
    }

    const discount = Number(form.memberDiscountPercent);
    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
      errors.memberDiscountPercent = "Enter a percentage between 0 and 100.";
    }

    if (
      form.salesStartDate &&
      form.salesEndDate &&
      form.salesEndDate < form.salesStartDate
    ) {
      errors.salesEndDate = "Sales must end on or after they start.";
    }

    if (
      form.accessStartTime &&
      form.accessEndTime &&
      form.accessEndTime <= form.accessStartTime
    ) {
      errors.accessEndTime = "The access window must end after it starts.";
    }

    if (
      form.lastSessionStartTime &&
      form.accessEndTime &&
      form.lastSessionStartTime > form.accessEndTime
    ) {
      errors.lastSessionStartTime =
        "The last session cannot start after access ends.";
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
        branchId: form.branchId,
        planName: form.planName.trim(),
        description: form.description.trim(),
        price,
        credits: Number(form.credits) || 0,
        validityDays,
        isUnlimitedClasses: form.isUnlimitedClasses,
        isPtIncluded: form.isPtIncluded,
        ptSessions: Number(form.ptSessions) || 0,
        isPopular: form.isPopular,
        planCategory: form.planCategory.trim(),
        registrationFee: Number(form.registrationFee) || 0,
        allowMultiBranchAccess: form.allowMultiBranchAccess,
        isActive: form.isActive,
        membershipType: form.membershipType,
        allowsClassAccess: form.allowsClassAccess,
        allowsOpenGymAccess: form.allowsOpenGymAccess,
        expiresAtEndOfDay: form.expiresAtEndOfDay,
        accessDaysOfWeek: serializeAccessDays(form.accessDays),
        accessStartTime: timeToWire(form.accessStartTime),
        accessEndTime: timeToWire(form.accessEndTime),
        lastSessionStartTime: timeToWire(form.lastSessionStartTime),
        isAvailableForSale: form.isAvailableForSale,
        salesStartDate: dateToWire(form.salesStartDate),
        salesEndDate: dateToWire(form.salesEndDate),
        memberDiscountPercent: discount,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      size="xl"
      title={plan ? "Edit Membership Plan" : "New Membership Plan"}
      subtitle="Price, validity and access. All of it is enforced by the backend."
    >
      <form id="plan-form" onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Plan
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Plan Name"
              htmlFor="pf-name"
              required
              error={fieldErrors.planName}
            >
              <input
                id="pf-name"
                type="text"
                className={inputClass(Boolean(fieldErrors.planName))}
                placeholder="e.g. Kedoya Limited"
                value={form.planName}
                onChange={(e) => set("planName", e.target.value)}
                maxLength={150}
              />
            </Field>

            <Field
              label="Membership Type"
              htmlFor="pf-type"
              hint="Decides the few rules that genuinely differ by product."
            >
              <select
                id="pf-type"
                className={inputClass()}
                value={form.membershipType}
                onChange={(e) => chooseType(e.target.value)}
              >
                <option value="">Not set</option>
                {MEMBERSHIP_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Branch"
              htmlFor="pf-branch"
              required
              error={fieldErrors.branchId}
            >
              <select
                id="pf-branch"
                className={inputClass(Boolean(fieldErrors.branchId))}
                value={form.branchId}
                onChange={(e) => set("branchId", e.target.value)}
              >
                <option value="">Select a branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Plan Category"
              htmlFor="pf-category"
              hint="Optional grouping used when the app lists plans."
            >
              <input
                id="pf-category"
                type="text"
                className={inputClass()}
                placeholder="e.g. Promo, Standard"
                value={form.planCategory}
                onChange={(e) => set("planCategory", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description" htmlFor="pf-description">
            <textarea
              id="pf-description"
              rows={3}
              className={inputClass()}
              placeholder="What the member gets."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Pricing &amp; Validity
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field
              label="Price (IDR)"
              htmlFor="pf-price"
              required
              error={fieldErrors.price}
              hint={currencyHint(form.price)}
            >
              <input
                id="pf-price"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                className={inputClass(Boolean(fieldErrors.price))}
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </Field>

            <Field
              label="Registration Fee (IDR)"
              htmlFor="pf-regfee"
              error={fieldErrors.registrationFee}
              hint={currencyHint(form.registrationFee)}
            >
              <input
                id="pf-regfee"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className={inputClass(Boolean(fieldErrors.registrationFee))}
                value={form.registrationFee}
                onChange={(e) => set("registrationFee", e.target.value)}
              />
            </Field>

            <Field
              label="Credits"
              htmlFor="pf-credits"
              hint="Sessions included. Unlimited plans usually sell zero."
            >
              <input
                id="pf-credits"
                type="number"
                step={1}
                min={0}
                inputMode="numeric"
                className={inputClass()}
                value={form.credits}
                onChange={(e) => set("credits", e.target.value)}
              />
            </Field>

            <Field
              label="Validity Days"
              htmlFor="pf-validity"
              required
              error={fieldErrors.validityDays}
            >
              <input
                id="pf-validity"
                type="number"
                step={1}
                min={1}
                inputMode="numeric"
                className={inputClass(Boolean(fieldErrors.validityDays))}
                value={form.validityDays}
                onChange={(e) => set("validityDays", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow
              id="pf-unlimited"
              label="Unlimited classes"
              description="Attend without spending credits."
              checked={form.isUnlimitedClasses}
              onChange={(v) => set("isUnlimitedClasses", v)}
            />
            <ToggleRow
              id="pf-endofday"
              label="Expires at end of day"
              description="Ends at midnight of the start day rather than after whole days. A 1 Day Pass does this."
              checked={form.expiresAtEndOfDay}
              onChange={(v) => set("expiresAtEndOfDay", v)}
            />
            <ToggleRow
              id="pf-pt"
              label="Includes PT sessions"
              checked={form.isPtIncluded}
              onChange={(v) => set("isPtIncluded", v)}
            />
            <Field label="PT Sessions" htmlFor="pf-ptsessions">
              <input
                id="pf-ptsessions"
                type="number"
                step={1}
                min={0}
                inputMode="numeric"
                className={inputClass()}
                value={form.ptSessions}
                onChange={(e) => set("ptSessions", e.target.value)}
                disabled={!form.isPtIncluded}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Access
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow
              id="pf-class-access"
              label="Allows class access"
              description="Open Gym plans turn this off."
              checked={form.allowsClassAccess}
              onChange={(v) => set("allowsClassAccess", v)}
            />
            <ToggleRow
              id="pf-gym-access"
              label="Allows open gym access"
              checked={form.allowsOpenGymAccess}
              onChange={(v) => set("allowsOpenGymAccess", v)}
            />
            <ToggleRow
              id="pf-multibranch"
              label="Multi-branch access"
              description="Usable at more than the branch it was bought at."
              checked={form.allowMultiBranchAccess}
              onChange={(v) => set("allowMultiBranchAccess", v)}
            />
            <ToggleRow
              id="pf-popular"
              label="Highlight as popular"
              checked={form.isPopular}
              onChange={(v) => set("isPopular", v)}
            />
          </div>

          <div>
            <span className={LABEL_CLASS}>Access Days</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = form.accessDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    aria-pressed={active}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      active
                        ? "bg-sweat text-black border-sweat"
                        : "bg-sidebar text-muted border-border hover:border-muted"
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-1">
              {form.accessDays.length === 0
                ? "No days selected — the plan is usable every day."
                : `Usable on ${form.accessDays.length} day${form.accessDays.length === 1 ? "" : "s"} a week.`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Access Start Time" htmlFor="pf-access-start">
              <input
                id="pf-access-start"
                type="time"
                className={inputClass()}
                value={form.accessStartTime}
                onChange={(e) => set("accessStartTime", e.target.value)}
              />
            </Field>
            <Field
              label="Access End Time"
              htmlFor="pf-access-end"
              error={fieldErrors.accessEndTime}
            >
              <input
                id="pf-access-end"
                type="time"
                className={inputClass(Boolean(fieldErrors.accessEndTime))}
                value={form.accessEndTime}
                onChange={(e) => set("accessEndTime", e.target.value)}
              />
            </Field>
            <Field
              label="Last Session Start"
              htmlFor="pf-last-session"
              error={fieldErrors.lastSessionStartTime}
              hint="The latest a class may start on this plan."
            >
              <input
                id="pf-last-session"
                type="time"
                className={inputClass(Boolean(fieldErrors.lastSessionStartTime))}
                value={form.lastSessionStartTime}
                onChange={(e) => set("lastSessionStartTime", e.target.value)}
              />
            </Field>
          </div>

          {form.membershipType === "Limited" ? (
            <InfoNote>
              The Limited plan at Kedoya runs Monday–Friday, 08:00–11:00, with
              the last session starting at 10:00. Set that here; the backend
              turns a member away outside the window whatever this screen shows.
            </InfoNote>
          ) : null}
        </section>

        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Sales Period
          </h4>

          <InfoNote>
            The sales period controls <strong>when this plan can be
            purchased</strong> — not how long a membership lasts once bought. A
            promo on sale 1 August → 30 September cannot be bought from 1
            October, but memberships already sold keep running for their full
            validity.
          </InfoNote>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sales Start Date" htmlFor="pf-sales-start">
              <input
                id="pf-sales-start"
                type="date"
                className={inputClass()}
                value={form.salesStartDate}
                onChange={(e) => set("salesStartDate", e.target.value)}
              />
            </Field>
            <Field
              label="Sales End Date"
              htmlFor="pf-sales-end"
              error={fieldErrors.salesEndDate}
            >
              <input
                id="pf-sales-end"
                type="date"
                className={inputClass(Boolean(fieldErrors.salesEndDate))}
                value={form.salesEndDate}
                onChange={(e) => set("salesEndDate", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow
              id="pf-active"
              label="Active"
              description="An inactive plan disappears from the catalogue but keeps working for members who hold it."
              checked={form.isActive}
              onChange={(v) => set("isActive", v)}
            />
            <ToggleRow
              id="pf-forsale"
              label="Available for sale"
              description="Independent of Active — a closed promo stays active for its holders."
              checked={form.isAvailableForSale}
              onChange={(v) => set("isAvailableForSale", v)}
            />
          </div>

          <Field
            label="Member Discount Percent"
            htmlFor="pf-discount"
            error={fieldErrors.memberDiscountPercent}
            hint={
              discountEligible
                ? "Applied by the backend when the customer already holds an active membership at either branch."
                : "Only Drop In and 1 Day Pass can be discounted. On any other type the backend ignores this value."
            }
          >
            <div className="flex items-center gap-3">
              <input
                id="pf-discount"
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                className={inputClass(
                  Boolean(fieldErrors.memberDiscountPercent)
                )}
                value={form.memberDiscountPercent}
                onChange={(e) => set("memberDiscountPercent", e.target.value)}
                disabled={!discountEligible}
              />
              {discountPreview !== null ? (
                <span className="text-xs text-muted whitespace-nowrap">
                  Member pays{" "}
                  <strong className="text-accent-ink">
                    {formatCurrency(discountPreview)}
                  </strong>
                </span>
              ) : null}
            </div>
          </Field>
        </section>

        <FormError message={error} />
      </form>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onClose} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <SubmitButton submitting={submitting} form="plan-form">
          <i className="fas fa-save" aria-hidden />
          {plan ? "Save Changes" : "Create Plan"}
        </SubmitButton>
      </div>
    </Modal>
  );
}
