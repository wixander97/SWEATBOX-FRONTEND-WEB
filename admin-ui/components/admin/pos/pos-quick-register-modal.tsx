"use client";

import { useState, type FormEvent } from "react";

import { errorMessageOf } from "@/lib/api/http";
import {
  findDuplicateMember,
  generateMemberPassword,
  memberDisplayName,
  registerMember,
  type ApiMember,
} from "@/lib/api/members";
import {
  MEMBERSHIP_SOURCE_OPTIONS,
  dateToIso,
} from "@/components/admin/members/members.types";

type Props = {
  /** Prefilled from whatever the staff already typed into the customer search. */
  initialQuery?: string;
  onClose: () => void;
  onCreated: (member: ApiMember) => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

/**
 * Front-desk quick registration: name, phone and email, plus the optional
 * profile details (gender, date of birth, emergency contact, injury/allergies
 * and how they heard about us) when the front desk has time to take them.
 *
 * Uses the existing `POST /api/v1/auth/register-member`, which provisions the
 * User account and the Member record together — the POS has no customer model
 * of its own. Duplicates are checked against the member search first, and the
 * backend's own validation is surfaced verbatim.
 */
export function PosQuickRegisterModal({ initialQuery = "", onClose, onCreated }: Props) {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(
    looksLikeEmail(initialQuery) ? "" : initialQuery.trim()
  );
  const [email, setEmail] = useState(looksLikeEmail(initialQuery) ? initialQuery.trim() : "");
  // Optional profile details, sent on registration when the front desk fills them in.
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [injuryAllergies, setInjuryAllergies] = useState("");
  const [membershipSource, setMembershipSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<ApiMember | null>(null);
  /** Set once registration succeeded, so staff can hand over next steps. */
  const [registered, setRegistered] = useState<ApiMember | null>(null);

  /** Only the details staff actually filled in, trimmed. */
  function optionalDetails() {
    const details: Record<string, string> = {};
    const put = (key: string, value: string) => {
      if (value.trim()) details[key] = value.trim();
    };
    put("gender", gender);
    put("emergencyContactName", emergencyContactName);
    put("emergencyContactPhone", emergencyContactPhone);
    put("emergencyContactRelation", emergencyContactRelation);
    put("injuryAllergies", injuryAllergies);
    put("membershipSource", membershipSource);
    const dob = dateToIso(dateOfBirth);
    return dob ? { ...details, dateOfBirth: dob } : details;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setDuplicate(null);

    if (!phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Invalid email address.");
      return;
    }
    if (!fullName.trim()) {
      setError("Name is required — the backend rejects registration without a name.");
      return;
    }

    setSubmitting(true);
    try {
      const existing = await findDuplicateMember(phoneNumber, email);
      if (existing) {
        setDuplicate(existing);
        return;
      }

      const member = await registerMember({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        // Backend requires >= 8 chars; the customer resets it via forgot-password.
        password: generateMemberPassword(),
        // Optional details are omitted entirely when blank, so registration
        // never overwrites anything with an empty value.
        ...optionalDetails(),
      });
      if (!member) {
        setError(
          "The customer was registered but does not appear in search yet. Try searching manually by email."
        );
        return;
      }
      setRegistered(member);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to register member"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold font-display uppercase text-fg">
              Quick Register
            </h3>
            <p className="text-xs text-muted mt-0.5">
              The customer account is created automatically; the password is set by the
              customer via &ldquo;forgot password&rdquo;.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-soft hover:text-fg text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {registered ? (
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-600 font-bold text-sm">✓ Customer Registered</p>
            </div>
            <div className="bg-sidebar rounded-lg border border-border px-3 py-2">
              <div className="flex justify-between py-1">
                <span className="text-[11px] text-muted uppercase">Name</span>
                <span className="text-xs text-fg-soft">{memberDisplayName(registered)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[11px] text-muted uppercase">Phone</span>
                <span className="text-xs text-fg-soft">{registered.phoneNumber || "-"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[11px] text-muted uppercase">Email</span>
                <span className="text-xs text-fg-soft">{registered.email || "-"}</span>
              </div>
            </div>

            {/*
              No password action here on purpose: the customer sets their own
              password through Forgot Password in the mobile app, so the front
              desk never triggers, sees or sets one.
            */}
            <p className="text-[11px] text-fg-soft">
              Ask the customer to open the mobile app and choose{" "}
              <span className="text-fg-soft font-semibold">Forgot Password</span> with the email
              above to set their own password, then sign in.
            </p>

            <button
              type="button"
              onClick={() => onCreated(registered)}
              className="w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
            >
              Select this customer
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <label className="block">
            <span className="text-muted text-xs uppercase font-bold">
              Phone Number <span className="text-red-500">*</span>
            </span>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              inputMode="tel"
              autoFocus
              placeholder="0812xxxxxxx"
              className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
            />
          </label>

          <label className="block">
            <span className="text-muted text-xs uppercase font-bold">
              Email <span className="text-red-500">*</span>
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="name@email.com"
              className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
            />
          </label>

          <label className="block">
            <span className="text-muted text-xs uppercase font-bold">
              Full Name <span className="text-red-500">*</span>
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Customer name"
              className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
            />
          </label>

          <div className="pt-2 border-t border-border">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
              Additional details (optional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-muted text-xs uppercase font-bold">Gender</span>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="block">
                <span className="text-muted text-xs uppercase font-bold">Date of Birth</span>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
                  style={{ colorScheme: "dark" }}
                />
              </label>

              <label className="block">
                <span className="text-muted text-xs uppercase font-bold">
                  Emergency Contact Name
                </span>
                <input
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
                />
              </label>

              <label className="block">
                <span className="text-muted text-xs uppercase font-bold">
                  Emergency Contact Relation
                </span>
                <input
                  value={emergencyContactRelation}
                  onChange={(e) => setEmergencyContactRelation(e.target.value)}
                  placeholder="e.g. Spouse, Parent, Friend"
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
                />
              </label>

              <label className="block">
                <span className="text-muted text-xs uppercase font-bold">
                  Emergency Contact Phone
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={13}
                  value={emergencyContactPhone}
                  onChange={(e) =>
                    setEmergencyContactPhone(
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 13)
                    )
                  }
                  placeholder="0812xxxxxxx"
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
                />
              </label>

              <label className="block">
                <span className="text-muted text-xs uppercase font-bold">
                  How did you hear about us?
                </span>
                <select
                  value={membershipSource}
                  onChange={(e) => setMembershipSource(e.target.value)}
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
                >
                  <option value="">Select...</option>
                  {MEMBERSHIP_SOURCE_OPTIONS.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-muted text-xs uppercase font-bold">
                  Injury / Allergies
                </span>
                <textarea
                  value={injuryAllergies}
                  onChange={(e) => setInjuryAllergies(e.target.value)}
                  rows={2}
                  placeholder="e.g. knee injury, peanut allergy — leave blank if none"
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat resize-y"
                />
              </label>
            </div>
          </div>

          {duplicate && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-600 text-xs font-bold uppercase">
                Customer already registered
              </p>
              <p className="text-sm text-fg mt-1">{memberDisplayName(duplicate)}</p>
              <p className="text-xs text-fg-soft">
                {duplicate.phoneNumber || "-"} · {duplicate.email || "-"}
              </p>
              <button
                type="button"
                onClick={() => onCreated(duplicate)}
                className="mt-2 w-full bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
              >
                Use this customer
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Register & Select"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 bg-sidebar border border-border text-fg py-2.5 rounded-lg text-sm disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
