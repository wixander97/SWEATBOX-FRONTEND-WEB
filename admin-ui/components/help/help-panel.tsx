"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { HelpGuide } from "@/lib/help/registry";
import { HELP_PATH } from "@/lib/help/registry";

type Props = {
  guide: HelpGuide | null;
  stepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
  /** POS runs as a kiosk, so the panel sits clear of the checkout controls. */
  compact?: boolean;
};

/**
 * The assistant's panel: one step of the current module's walkthrough.
 *
 * Rendered as a dialog rather than a modal one — the page behind stays usable,
 * because a walkthrough that blocks the control it is describing is useless.
 * Focus moves here on open so keyboard users land on the step, and Escape is
 * handled by the parent so it works wherever focus happens to be.
 */
export function HelpPanel({
  guide,
  stepIndex,
  onBack,
  onNext,
  onClose,
  compact = false,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const steps = guide?.steps ?? [];
  const total = steps.length;
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = total > 0 && stepIndex === total - 1;

  return (
    <div
      role="dialog"
      aria-label="Help Assistant"
      aria-modal="false"
      /*
       * Anchored bottom-right, and lifted clear of the POS checkout bar.
       *
       * The POS renders a full-width Pay bar below `lg`, so on those widths the
       * compact panel starts above it rather than on top of it — the one control
       * the assistant must never cover is the one that takes money.
       */
      className={`fixed z-[70] bg-card border border-border rounded-2xl shadow-2xl flex flex-col
        inset-x-3 max-h-[70vh]
        sm:inset-x-auto sm:right-4 sm:w-[22rem]
        ${compact
          ? "bottom-36 sm:bottom-36 lg:bottom-20"
          : "bottom-20 sm:bottom-20"}`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-sm font-bold font-display uppercase tracking-wide text-fg outline-none"
          >
            Help Assistant
          </h2>
          <p className="text-[11px] text-muted truncate mt-0.5">
            {guide ? guide.title : "This page"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Help Assistant"
          className="text-muted hover:text-fg text-xl leading-none shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat rounded"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-4 overflow-y-auto flex-1">
        {!guide || total === 0 ? (
          <div className="text-center py-6">
            <i className="fas fa-book-open text-2xl text-muted mb-3 block" aria-hidden />
            <p className="text-sm text-fg font-semibold mb-1">
              Help for this page is coming soon.
            </p>
            <p className="text-xs text-muted">
              Browse every module guide from Help &amp; Support.
            </p>
          </div>
        ) : (
          <>
            {/* Screen readers get the position before the content, so the step
                is announced as "Step 2 of 5" rather than as a bare heading. */}
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-2">
              Step {stepIndex + 1} of {total}
            </p>
            <h3 className="text-base font-bold text-fg mb-1.5">{step.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{step.body}</p>

            <div
              className="flex items-center gap-1.5 mt-4"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={stepIndex + 1}
              aria-label={`Step ${stepIndex + 1} of ${total}`}
            >
              {steps.map((s, i) => (
                <span
                  key={s.title}
                  aria-hidden
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= stepIndex ? "bg-sweat" : "bg-border"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border space-y-2">
        {guide && total > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isFirst}
              className="flex-1 bg-sidebar border border-border text-fg-soft py-2 rounded-lg text-xs font-bold transition hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
            >
              Back
            </button>
            <button
              type="button"
              onClick={isLast ? onClose : onNext}
              className="flex-1 bg-sweat text-black py-2 rounded-lg text-xs font-bold transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat"
            >
              {isLast ? "Finish" : "Next →"}
            </button>
          </div>
        )}

        <Link
          href={guide ? `${HELP_PATH}?module=${guide.id}` : HELP_PATH}
          onClick={onClose}
          className="block text-center text-[11px] font-bold text-accent-ink hover:underline py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sweat rounded"
        >
          {guide ? "View Full Guide →" : "Open Help & Support →"}
        </Link>
      </div>
    </div>
  );
}
