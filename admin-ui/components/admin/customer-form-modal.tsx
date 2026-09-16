"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  GENDER_OPTIONS,
  HEAR_ABOUT_US_OPTIONS,
  type CustomerFormValues,
} from "@/lib/members";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  title?: string;
  submitLabel?: string;
  initialValues?: Partial<CustomerFormValues>;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
};

const FIELD_CLASS =
  "w-full bg-sidebar border border-border text-fg px-4 py-3 rounded-lg focus:outline-none focus:border-sweat";
const LABEL_CLASS = "block text-muted text-sm mb-1";

/**
 * Editing an existing customer.
 *
 * Registration no longer goes through here — it goes through
 * `QuickRegisterModal`, which collects the complete mandatory field set plus
 * the waiver, house rules and signature that
 * `POST /api/v1/members/register` requires.
 *
 * This form stays deliberately permissive: it edits members who were created
 * before those answers were collected, and the update API leaves a field it is
 * not sent alone. Forcing a value here would mean inventing one for a member
 * who was never asked.
 */
export function CustomerFormModal({
  open,
  mode,
  onClose,
  title = mode === "create" ? "Add New Customer" : "Edit Customer",
  submitLabel = mode === "create" ? "Register Customer" : "Save Changes",
  initialValues,
  onSubmit,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);
      const fd = new FormData(e.currentTarget);
      const values: CustomerFormValues = {
        fullName: String(fd.get("fullName") ?? ""),
        gender: String(fd.get("gender") ?? ""),
        dateOfBirth: String(fd.get("dateOfBirth") ?? ""),
        phoneNumber: String(fd.get("phoneNumber") ?? ""),
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        emergencyContactName: String(fd.get("emergencyContactName") ?? ""),
        emergencyContactRelation: String(
          fd.get("emergencyContactRelation") ?? ""
        ),
        emergencyContactPhone: String(fd.get("emergencyContactPhone") ?? ""),
        injuryAllergies: String(fd.get("injuryAllergies") ?? ""),
        howDidYouHearAboutUs: String(fd.get("howDidYouHearAboutUs") ?? ""),
      };

      try {
        await onSubmit(values);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to submit";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [onClose, onSubmit]
  );

  if (!open) return null;

  const creating = mode === "create";

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="customer-modal-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h3
            className="text-xl font-bold font-display uppercase"
            id="customer-modal-title"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS} htmlFor="cf-fullName">
                Full Name
              </label>
              <input
                id="cf-fullName"
                type="text"
                name="fullName"
                className={FIELD_CLASS}
                placeholder="e.g. Andi Pratama"
                defaultValue={initialValues?.fullName ?? ""}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS} htmlFor="cf-gender">
                  Gender
                </label>
                <select
                  id="cf-gender"
                  name="gender"
                  className={FIELD_CLASS}
                  defaultValue={initialValues?.gender ?? ""}
                >
                  <option value="">Not specified</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {/* Keeps a legacy value visible instead of silently
                      resetting it to "Not specified" on save. */}
                  {initialValues?.gender &&
                  !GENDER_OPTIONS.includes(
                    initialValues.gender as (typeof GENDER_OPTIONS)[number]
                  ) ? (
                    <option value={initialValues.gender}>
                      {initialValues.gender}
                    </option>
                  ) : null}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="cf-dateOfBirth">
                  Date of Birth
                </label>
                <input
                  id="cf-dateOfBirth"
                  type="date"
                  name="dateOfBirth"
                  className={FIELD_CLASS}
                  defaultValue={initialValues?.dateOfBirth ?? ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS} htmlFor="cf-phoneNumber">
                  Mobile No.
                </label>
                <input
                  id="cf-phoneNumber"
                  type="tel"
                  name="phoneNumber"
                  className={FIELD_CLASS}
                  placeholder="e.g. 08123456789"
                  defaultValue={initialValues?.phoneNumber ?? ""}
                  required={creating}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="cf-email">
                  Email
                </label>
                <input
                  id="cf-email"
                  type="email"
                  name="email"
                  className={`${FIELD_CLASS} disabled:opacity-60`}
                  defaultValue={initialValues?.email ?? ""}
                  required={creating}
                  /* The update API has no email field, so editing one here
                     would look like it saved and quietly not. */
                  disabled={!creating}
                />
                {!creating ? (
                  <p className="text-xs text-muted mt-1">
                    Email cannot be changed here.
                  </p>
                ) : null}
              </div>
            </div>

            {creating ? (
              <div>
                <label className={LABEL_CLASS} htmlFor="cf-password">
                  Initial Password
                </label>
                <input
                  id="cf-password"
                  type="password"
                  name="password"
                  className={FIELD_CLASS}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  required
                />
              </div>
            ) : null}

            <fieldset className="border border-border rounded-lg p-4 space-y-4">
              <legend className="px-2 text-sm font-bold text-fg uppercase font-display">
                Emergency Contact
              </legend>
              <div>
                <label
                  className={LABEL_CLASS}
                  htmlFor="cf-emergencyContactName"
                >
                  Name
                </label>
                <input
                  id="cf-emergencyContactName"
                  type="text"
                  name="emergencyContactName"
                  className={FIELD_CLASS}
                  defaultValue={initialValues?.emergencyContactName ?? ""}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className={LABEL_CLASS}
                    htmlFor="cf-emergencyContactRelation"
                  >
                    Relation
                  </label>
                  <input
                    id="cf-emergencyContactRelation"
                    type="text"
                    name="emergencyContactRelation"
                    className={FIELD_CLASS}
                    placeholder="e.g. Spouse, Parent"
                    defaultValue={initialValues?.emergencyContactRelation ?? ""}
                  />
                </div>
                <div>
                  <label
                    className={LABEL_CLASS}
                    htmlFor="cf-emergencyContactPhone"
                  >
                    Mobile No.
                  </label>
                  <input
                    id="cf-emergencyContactPhone"
                    type="tel"
                    name="emergencyContactPhone"
                    className={FIELD_CLASS}
                    defaultValue={initialValues?.emergencyContactPhone ?? ""}
                  />
                </div>
              </div>
            </fieldset>

            <div>
              <label className={LABEL_CLASS} htmlFor="cf-injuryAllergies">
                Injury / Allergies
              </label>
              <textarea
                id="cf-injuryAllergies"
                name="injuryAllergies"
                rows={3}
                className={FIELD_CLASS}
                placeholder="Leave blank if none"
                defaultValue={initialValues?.injuryAllergies ?? ""}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="cf-howDidYouHearAboutUs">
                How did you hear about us?
              </label>
              <select
                id="cf-howDidYouHearAboutUs"
                name="howDidYouHearAboutUs"
                className={FIELD_CLASS}
                defaultValue={initialValues?.howDidYouHearAboutUs ?? ""}
              >
                <option value="">Not specified</option>
                {HEAR_ABOUT_US_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                {/* Members registered before this list existed carry sources
                    like "Walk In" or "Website"; showing the stored value keeps
                    an unrelated edit from rewriting it. */}
                {initialValues?.howDidYouHearAboutUs &&
                !HEAR_ABOUT_US_OPTIONS.includes(
                  initialValues.howDidYouHearAboutUs as (typeof HEAR_ABOUT_US_OPTIONS)[number]
                ) ? (
                  <option value={initialValues.howDidYouHearAboutUs}>
                    {initialValues.howDidYouHearAboutUs}
                  </option>
                ) : null}
              </select>
            </div>

            {error ? (
              <p className="text-sm text-danger bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-sweat text-black font-bold py-3 rounded-lg mt-4 hover:bg-yellow-400 transition disabled:opacity-70"
            >
              {submitting ? "Submitting..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
