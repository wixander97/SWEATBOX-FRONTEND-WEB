"use client";

import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/api/client";
import type { AgreementDocument } from "@/lib/agreements";

/**
 * One agreement the member must read before accepting.
 *
 * The text is fetched rather than hard-coded so the member signs the version
 * that is actually current, and the acceptance is recorded against it. The
 * checkbox stays disabled until the document has been scrolled to the end:
 * "review, then accept" is the requirement, and a tick box on unread text is
 * not a review.
 */

export function AgreementConsent({
  documentType,
  label,
  accepted,
  onAcceptedChange,
  disabled,
  error,
}: {
  /** "Waiver" or "HouseRules". */
  documentType: string;
  label: string;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const [document, setDocument] = useState<AgreementDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await apiRequest<AgreementDocument>(
          `/api/agreements/documents/active/${encodeURIComponent(documentType)}`
        );
        if (!cancelled) setDocument(data);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [documentType]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    // A few pixels of slack: sub-pixel heights mean the numbers rarely meet
    // exactly at the bottom.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
      setReviewed(true);
    }
  }

  /** A document short enough not to scroll counts as reviewed on sight. */
  function onContentRef(el: HTMLDivElement | null) {
    if (el && el.scrollHeight <= el.clientHeight + 4) {
      setReviewed(true);
    }
  }

  const checkboxId = `agree-${documentType}`;

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        error ? "border-red-500/60 bg-red-500/5" : "border-border bg-sidebar/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-fg">{label}</p>
          {document ? (
            <p className="text-xs text-muted">
              {document.title} • version {document.version}
            </p>
          ) : null}
        </div>
        {accepted ? (
          <span className="text-xs text-success font-bold whitespace-nowrap">
            <i className="fas fa-check mr-1" aria-hidden />
            Accepted
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-muted">
          <i className="fas fa-circle-notch fa-spin mr-2" aria-hidden />
          Loading the current {label.toLowerCase()}…
        </p>
      ) : loadError ? (
        <p className="text-xs text-danger">
          {loadError} The member cannot accept a document that has not loaded —
          check that an active version is configured under Agreement Documents.
        </p>
      ) : (
        <div
          ref={onContentRef}
          onScroll={onScroll}
          className="max-h-44 overflow-y-auto rounded-lg bg-dark border border-border p-3 text-xs text-fg-soft whitespace-pre-wrap leading-relaxed"
          tabIndex={0}
          role="region"
          aria-label={`${label} text`}
        >
          {document?.content}
        </div>
      )}

      <label
        htmlFor={checkboxId}
        className={`flex items-start gap-3 ${
          disabled || !document || !reviewed
            ? "opacity-60 cursor-not-allowed"
            : "cursor-pointer"
        }`}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={accepted}
          disabled={disabled || !document || !reviewed}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#ffd700] shrink-0"
        />
        <span className="text-xs text-fg-soft">
          The member has read and accepts the {label.toLowerCase()}
          <span className="text-accent-ink ml-1" aria-hidden>
            *
          </span>
          {!reviewed && document ? (
            <span className="block text-muted mt-0.5">
              Scroll to the end of the text to enable this.
            </span>
          ) : null}
        </span>
      </label>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
