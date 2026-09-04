"use client";

import { useState, type FormEvent } from "react";

import { errorMessageOf } from "@/lib/api/http";
import {
  findDuplicateMember,
  generateMemberPassword,
  memberDisplayName,
  registerMember,
  sendPasswordReset,
  type ApiMember,
} from "@/lib/api/members";

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
 * Front-desk quick registration: name, phone and email.
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<ApiMember | null>(null);
  /** Set once registration succeeded, so staff can hand over next steps. */
  const [registered, setRegistered] = useState<ApiMember | null>(null);
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle"
  );
  const [resetError, setResetError] = useState("");


  async function sendReset(email: string) {
    setResetState("sending");
    setResetError("");
    try {
      await sendPasswordReset(email);
      setResetState("sent");
    } catch (err) {
      setResetState("failed");
      setResetError(errorMessageOf(err, "Gagal mengirim reset password"));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setDuplicate(null);

    if (!phoneNumber.trim()) {
      setError("Nomor telepon wajib diisi.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Email tidak valid.");
      return;
    }
    if (!fullName.trim()) {
      setError("Nama wajib diisi — backend menolak registrasi tanpa nama.");
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
      });
      if (!member) {
        setError(
          "Customer terdaftar, tapi belum muncul di pencarian. Coba cari manual dengan emailnya."
        );
        return;
      }
      setRegistered(member);
    } catch (err) {
      setError(errorMessageOf(err, "Gagal mendaftarkan member"));
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
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold font-display uppercase text-fg">
              Quick Register
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Akun customer dibuat otomatis; password di-reset sendiri lewat
              &ldquo;forgot password&rdquo;.
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

            <p className="text-[11px] text-fg-soft">
              Customer bisa membuat password sendiri lewat{" "}
              <span className="text-fg-soft font-semibold">Forgot Password</span> di aplikasi
              mobile, lalu login. Staff tidak pernah melihat atau mengatur password customer.
            </p>

            {registered.email && (
              <button
                type="button"
                onClick={() => void sendReset(registered.email as string)}
                disabled={resetState === "sending" || resetState === "sent"}
                className="w-full bg-sidebar border border-border text-fg py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                <i className="fas fa-envelope mr-2" aria-hidden />
                {resetState === "sending"
                  ? "Mengirim..."
                  : resetState === "sent"
                    ? "Reset password terkirim ✓"
                    : "Send Password Reset"}
              </button>
            )}

            {resetError && <p className="text-xs text-red-500">{resetError}</p>}

            <button
              type="button"
              onClick={() => onCreated(registered)}
              className="w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
            >
              Pilih customer ini
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
              placeholder="nama@email.com"
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
              placeholder="Nama customer"
              className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-sweat"
            />
          </label>

          {duplicate && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-600 text-xs font-bold uppercase">
                Customer sudah terdaftar
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
                Gunakan customer ini
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
              {submitting ? "Menyimpan..." : "Register & Select"}
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
