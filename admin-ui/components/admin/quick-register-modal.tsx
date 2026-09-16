"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AgreementConsent } from "@/components/admin/agreement-consent";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import {
  Field,
  FormError,
  InfoNote,
  inputClass,
} from "@/components/ui/field";
import { SignaturePad } from "@/components/ui/signature-pad";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiRequest, errorMessage } from "@/lib/api/client";
import { dateToWire, todayInJakarta } from "@/lib/format";
import type { Branch } from "@/lib/branches";
import {
  EMERGENCY_RELATION_OPTIONS,
  GENDER_OPTIONS,
  HEAR_ABOUT_US_OPTIONS,
  type RegisterMemberRequest,
  type RegisteredMember,
} from "@/lib/member-registration";

/**
 * Registering a member at the desk.
 *
 * Every field is required, including the injury declaration — a member with
 * nothing to declare answers "None" rather than leaving it blank — and the
 * registration cannot be completed without the waiver, the house rules and a
 * drawn signature. There is no "additional details (optional)" section: the
 * business made the whole form mandatory, and the backend enforces it, so
 * presenting half of it as optional would only produce registrations the server
 * rejects.
 *
 * On success the backend emails the welcome pack with the signed PDFs. The
 * screen reports what the backend says happened; it never claims delivery the
 * API did not confirm.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  /** Preselected home club, e.g. the POS branch. */
  defaultBranchId?: string | null;
  /** The label on the submit button — POS continues into the sale. */
  submitLabel?: string;
  /**
   * What the desk already typed into the customer search. An email prefills
   * the email field; anything else prefills the phone number.
   */
  initialQuery?: string;
  /**
   * Checked before registering. Returning content stops the registration and
   * shows it instead — POS uses it to offer the customer who already exists.
   */
  checkDuplicate?: (phoneNumber: string, email: string) => Promise<ReactNode | null>;
  onRegistered: (member: RegisteredMember) => void;
};

type FormState = {
  phoneNumber: string;
  email: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  membershipSource: string;
  injuryAllergies: string;
  homeClubBranchId: string;
};

function emptyForm(
  defaultBranchId?: string | null,
  initialQuery = ""
): FormState {
  const query = initialQuery.trim();
  const isEmail = query.includes("@");
  return {
    phoneNumber: isEmail ? "" : query,
    email: isEmail ? query : "",
    fullName: "",
    gender: "",
    dateOfBirth: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    membershipSource: "",
    injuryAllergies: "",
    homeClubBranchId: defaultBranchId ?? "",
  };
}

const REQUIRED_LABELS: Record<keyof FormState, string> = {
  phoneNumber: "Phone number",
  email: "Email",
  fullName: "Full name",
  gender: "Gender",
  dateOfBirth: "Date of birth",
  emergencyContactName: "Emergency contact name",
  emergencyContactRelation: "Emergency contact relation",
  emergencyContactPhone: "Emergency contact phone",
  membershipSource: "How did you hear about us",
  injuryAllergies: "Injury / allergies",
  homeClubBranchId: "Home club",
};

export function QuickRegisterModal({
  open,
  onClose,
  branches,
  defaultBranchId,
  submitLabel = "Register & Select",
  initialQuery,
  checkDuplicate,
  onRegistered,
}: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(defaultBranchId, initialQuery)
  );
  const [duplicate, setDuplicate] = useState<ReactNode | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [houseRulesAccepted, setHouseRulesAccepted] = useState(false);
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultBranchId, initialQuery));
    setDuplicate(null);
    setWaiverAccepted(false);
    setHouseRulesAccepted(false);
    setSignature("");
    setError(null);
    setFieldErrors({});
  }, [open, defaultBranchId, initialQuery]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  /**
   * The same checks the backend runs, so the desk sees them against the field
   * rather than as one sentence after a round trip. The server still decides.
   */
  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};

    (Object.keys(REQUIRED_LABELS) as (keyof FormState)[]).forEach((key) => {
      // The home club is genuinely optional on the API; everything else is not.
      if (key === "homeClubBranchId") return;
      if (!form[key].trim()) {
        errors[key] = `${REQUIRED_LABELS[key]} is required.`;
      }
    });

    if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      errors.email = "Email address is not valid.";
    }

    if (form.dateOfBirth && form.dateOfBirth >= todayInJakarta()) {
      errors.dateOfBirth = "Date of birth must be in the past.";
    }

    if (!waiverAccepted) {
      errors.waiver = "The waiver must be accepted to complete registration.";
    }
    if (!houseRulesAccepted) {
      errors.houseRules =
        "The house rules must be accepted to complete registration.";
    }
    if (!signature) {
      errors.signature =
        "A digital signature is required to complete registration.";
    }

    return errors;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Please complete every required field before registering.");
      return;
    }

    const body: RegisterMemberRequest = {
      phoneNumber: form.phoneNumber.trim(),
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      gender: form.gender,
      dateOfBirth: dateToWire(form.dateOfBirth),
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactRelation: form.emergencyContactRelation.trim(),
      emergencyContactPhone: form.emergencyContactPhone.trim(),
      membershipSource: form.membershipSource,
      injuryAllergies: form.injuryAllergies.trim(),
      waiverAccepted,
      houseRulesAccepted,
      signatureImageData: signature,
      homeClubBranchId: form.homeClubBranchId || null,
    };

    setError(null);
    setDuplicate(null);
    setSubmitting(true);
    try {
      if (checkDuplicate) {
        const existing = await checkDuplicate(body.phoneNumber, body.email);
        if (existing) {
          setDuplicate(existing);
          return;
        }
      }

      const member = await apiRequest<RegisteredMember>(
        "/api/members/register",
        { method: "POST", body }
      );

      // The welcome email is reported separately: registration succeeds even
      // when delivery fails, and telling the desk it was sent when it was not
      // would leave a member waiting for documents that never arrive.
      if (member.welcomeEmailSent) {
        toast.success(
          "Member registered successfully.",
          "Welcome email and agreement documents have been sent."
        );
      } else {
        toast.warning(
          "Member registered successfully.",
          member.welcomeEmailError
            ? `The welcome email could not be sent: ${member.welcomeEmailError}`
            : "The welcome email could not be sent. Resend the documents from the member's record."
        );
      }

      onRegistered(member);
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

  const ready =
    waiverAccepted && houseRulesAccepted && Boolean(signature);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      size="xl"
      title="Quick Register"
      subtitle="All fields are required. The member signs the waiver and house rules here."
    >
      <form id="quick-register-form" onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Member Details
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Full Name"
              htmlFor="qr-fullName"
              required
              error={fieldErrors.fullName}
            >
              <input
                id="qr-fullName"
                type="text"
                autoComplete="off"
                className={inputClass(Boolean(fieldErrors.fullName))}
                placeholder="e.g. Andi Pratama"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
              />
            </Field>

            <Field
              label="Phone Number"
              htmlFor="qr-phone"
              required
              error={fieldErrors.phoneNumber}
            >
              <input
                id="qr-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className={inputClass(Boolean(fieldErrors.phoneNumber))}
                placeholder="e.g. 08123456789"
                value={form.phoneNumber}
                onChange={(e) => set("phoneNumber", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Email"
              htmlFor="qr-email"
              required
              error={fieldErrors.email}
              hint="The welcome email and signed documents are sent here."
            >
              <input
                id="qr-email"
                type="email"
                autoComplete="off"
                className={inputClass(Boolean(fieldErrors.email))}
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>

            <Field
              label="Home Club"
              htmlFor="qr-branch"
              hint="Optional — the branch this member belongs to."
            >
              <select
                id="qr-branch"
                className={inputClass()}
                value={form.homeClubBranchId}
                onChange={(e) => set("homeClubBranchId", e.target.value)}
              >
                <option value="">Not set</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field
              label="Gender"
              htmlFor="qr-gender"
              required
              error={fieldErrors.gender}
            >
              <select
                id="qr-gender"
                className={inputClass(Boolean(fieldErrors.gender))}
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">Select</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Date of Birth"
              htmlFor="qr-dob"
              required
              error={fieldErrors.dateOfBirth}
            >
              <input
                id="qr-dob"
                type="date"
                max={todayInJakarta()}
                className={inputClass(Boolean(fieldErrors.dateOfBirth))}
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
              />
            </Field>

            <Field
              label="How Did You Hear About Us?"
              htmlFor="qr-source"
              required
              error={fieldErrors.membershipSource}
            >
              <select
                id="qr-source"
                className={inputClass(Boolean(fieldErrors.membershipSource))}
                value={form.membershipSource}
                onChange={(e) => set("membershipSource", e.target.value)}
              >
                <option value="">Select</option>
                {HEAR_ABOUT_US_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Emergency Contact
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field
              label="Name"
              htmlFor="qr-ec-name"
              required
              error={fieldErrors.emergencyContactName}
            >
              <input
                id="qr-ec-name"
                type="text"
                className={inputClass(Boolean(fieldErrors.emergencyContactName))}
                value={form.emergencyContactName}
                onChange={(e) => set("emergencyContactName", e.target.value)}
              />
            </Field>

            <Field
              label="Relation"
              htmlFor="qr-ec-relation"
              required
              error={fieldErrors.emergencyContactRelation}
            >
              <select
                id="qr-ec-relation"
                className={inputClass(
                  Boolean(fieldErrors.emergencyContactRelation)
                )}
                value={form.emergencyContactRelation}
                onChange={(e) =>
                  set("emergencyContactRelation", e.target.value)
                }
              >
                <option value="">Select</option>
                {EMERGENCY_RELATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Phone"
              htmlFor="qr-ec-phone"
              required
              error={fieldErrors.emergencyContactPhone}
            >
              <input
                id="qr-ec-phone"
                type="tel"
                inputMode="tel"
                className={inputClass(
                  Boolean(fieldErrors.emergencyContactPhone)
                )}
                value={form.emergencyContactPhone}
                onChange={(e) => set("emergencyContactPhone", e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Injury / Allergies"
            htmlFor="qr-injury"
            required
            error={fieldErrors.injuryAllergies}
            hint='A declaration, not an optional note — enter "None" if there is nothing to declare.'
          >
            <textarea
              id="qr-injury"
              rows={3}
              className={inputClass(Boolean(fieldErrors.injuryAllergies))}
              placeholder="e.g. None, or: previous ACL reconstruction (left knee)"
              value={form.injuryAllergies}
              onChange={(e) => set("injuryAllergies", e.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Agreements &amp; Signature
          </h4>

          <AgreementConsent
            documentType="Waiver"
            label="Waiver"
            accepted={waiverAccepted}
            onAcceptedChange={setWaiverAccepted}
            disabled={submitting}
            error={fieldErrors.waiver}
          />

          <AgreementConsent
            documentType="HouseRules"
            label="House Rules"
            accepted={houseRulesAccepted}
            onAcceptedChange={setHouseRulesAccepted}
            disabled={submitting}
            error={fieldErrors.houseRules}
          />

          <SignaturePad
            value={signature}
            onChange={setSignature}
            disabled={submitting}
            error={fieldErrors.signature}
          />

          <InfoNote>
            On registration the backend generates the signed waiver and house
            rules as PDFs and emails them with the welcome message. Nothing is
            generated in this browser.
          </InfoNote>
        </section>

        {duplicate}
        <FormError message={error} />
      </form>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
        <p className="text-xs text-muted">
          {ready
            ? "Agreements accepted and signature captured."
            : "Waiver, house rules and signature are all required."}
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <SecondaryButton onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <SubmitButton
            submitting={submitting}
            form="quick-register-form"
            disabled={!ready}
          >
            <i className="fas fa-user-plus" aria-hidden />
            {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </Modal>
  );
}
