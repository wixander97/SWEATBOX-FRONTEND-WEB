"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Field, FormError, inputClass } from "@/components/ui/field";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import { errorMessageOf } from "@/lib/api/http";
import { adjustLoyaltyPoints, getLoyaltyAccount, type LoyaltyLedgerEntry } from "@/lib/api/loyalty";
import { searchMembers, type ApiMember } from "@/lib/api/members";

export type PickedMember = { id: string; name: string; code: string };

type Props = {
  /** Preselected member (from the Customers tab or the Members page). */
  member?: PickedMember | null;
  onClose: () => void;
  onAdjusted: (entry: LoyaltyLedgerEntry) => void;
};

/**
 * Manual points adjustment (`POST /api/v1/loyalty/adjustments`).
 *
 * The reason is required and kept on the ledger with who made it. A deduction
 * that would take the balance below zero is refused by the backend, and its
 * message is shown as is.
 */
export function AdjustPointsModal({ member: initialMember = null, onClose, onAdjusted }: Props) {
  const [member, setMember] = useState<PickedMember | null>(initialMember);
  const [balance, setBalance] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LoyaltyLedgerEntry | null>(null);

  // Current balance of the picked member, so the desk sees what it changes.
  useEffect(() => {
    if (!member) return;
    let cancelled = false;
    getLoyaltyAccount(member.id)
      .then((account) => {
        if (!cancelled) setBalance(account.balance);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [member]);

  // Debounced member search.
  useEffect(() => {
    if (member) return;
    const keyword = query.trim();
    if (keyword.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchMembers(keyword)
        .then((list) => {
          if (!cancelled) setResults(list);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, member]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!member) {
      setError("Choose a member first.");
      return;
    }
    const amount = Number(points);
    if (!Number.isInteger(amount) || amount < 1) {
      setError("Points must be a whole number of at least 1.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const entry = await adjustLoyaltyPoints({
        memberId: member.id,
        points: direction === "add" ? amount : -amount,
        reason: reason.trim(),
      });
      setDone(entry);
      onAdjusted(entry);
    } catch (err) {
      setError(errorMessageOf(err, "Failed to adjust points"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Modal open onClose={onClose} title="Points adjusted">
        <div className="text-center space-y-2 py-2">
          <i className="fas fa-circle-check text-success text-3xl" aria-hidden />
          <p className="text-sm text-fg">
            {done.points > 0 ? "Added" : "Deducted"}{" "}
            <strong>{Math.abs(done.points)}</strong> point{Math.abs(done.points) === 1 ? "" : "s"}{" "}
            {done.points > 0 ? "to" : "from"} <strong>{done.memberName || member?.name}</strong>.
          </p>
          <p className="text-sm text-muted">
            New balance: <span className="font-bold text-accent-ink">{done.balanceAfter}</span> points
          </p>
        </div>
        <div className="flex justify-end mt-6">
          <SubmitButton type="button" onClick={onClose}>
            Done
          </SubmitButton>
        </div>
      </Modal>
    );
  }

  const amount = Number(points);
  const preview =
    balance !== null && Number.isInteger(amount) && amount > 0
      ? balance + (direction === "add" ? amount : -amount)
      : null;

  return (
    <Modal open onClose={onClose} busy={submitting} title="Adjust points">
      <form id="adjust-points-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Member" htmlFor="ap-member" required>
          {member ? (
            <div className="flex items-center justify-between gap-3 bg-sidebar border border-border rounded-lg px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-fg truncate">{member.name}</p>
                <p className="text-[11px] font-mono text-accent-ink">
                  {member.code}
                  {balance !== null ? (
                    <span className="text-muted font-sans"> · {balance} points</span>
                  ) : null}
                </p>
              </div>
              {initialMember ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setMember(null);
                    setBalance(null);
                  }}
                  className="text-xs text-muted hover:text-fg"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <div>
              <input
                id="ap-member"
                type="text"
                autoComplete="off"
                className={inputClass()}
                placeholder="Search name, code, phone or email…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.trim().length < 2) setResults([]);
                }}
              />
              {query.trim().length >= 2 ? (
                <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-sidebar divide-y divide-border">
                  {searching ? (
                    <li className="px-4 py-2 text-xs text-muted">Searching…</li>
                  ) : results.length === 0 ? (
                    <li className="px-4 py-2 text-xs text-muted">No members found.</li>
                  ) : (
                    results.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setMember({
                              id: m.id,
                              name: m.fullName || m.memberCode || m.id,
                              code: m.memberCode || "",
                            })
                          }
                          className="w-full text-left px-4 py-2 hover:bg-fg/5"
                        >
                          <span className="block text-sm text-fg">{m.fullName || "-"}</span>
                          <span className="block text-[11px] font-mono text-accent-ink">
                            {m.memberCode}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          )}
        </Field>

        <div role="radiogroup" aria-label="Adjustment direction" className="grid grid-cols-2 bg-sidebar border border-border rounded-lg p-1">
          {(["add", "deduct"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => setDirection(d)}
              className={`py-2 rounded-md text-sm transition inline-flex items-center justify-center gap-2 ${
                direction === d
                  ? d === "add"
                    ? "bg-green-600 text-white font-bold"
                    : "bg-red-600 text-white font-bold"
                  : "text-muted hover:text-fg"
              }`}
            >
              <i className={`fas ${d === "add" ? "fa-plus" : "fa-minus"}`} aria-hidden />
              {d === "add" ? "Add" : "Deduct"}
            </button>
          ))}
        </div>

        <Field
          label="Points"
          htmlFor="ap-points"
          required
          hint={preview !== null ? `Balance after: ${preview} points` : undefined}
        >
          <input
            id="ap-points"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className={inputClass()}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </Field>

        <Field label="Reason" htmlFor="ap-reason" required hint="Kept on the ledger with your name and the time.">
          <textarea
            id="ap-reason"
            rows={2}
            maxLength={500}
            className={inputClass()}
            placeholder="e.g. Goodwill for cancelled class"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <FormError message={error} />
      </form>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onClose} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <SubmitButton submitting={submitting} form="adjust-points-form">
          <i className="fas fa-check" aria-hidden />
          {direction === "add" ? "Add points" : "Deduct points"}
        </SubmitButton>
      </div>
    </Modal>
  );
}
