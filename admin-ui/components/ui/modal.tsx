"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The dialog shell the portal already uses, extracted so every new screen gets
 * the same overlay, sizing and close affordances instead of another copy.
 *
 * Escape closes and background scrolling is locked while a dialog is open —
 * both were missing from the hand-rolled copies and are cheap to get right
 * once.
 */

type Size = "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  footer,
  /** Blocks the overlay and escape while a submit is in flight. */
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  size?: Size;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-start sm:items-center justify-center backdrop-blur-sm overflow-y-auto p-3 sm:p-6"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`bg-card w-full ${SIZE_CLASS[size]} rounded-2xl border border-border shadow-2xl my-auto max-h-[92vh] flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex justify-between items-start gap-4 p-4 sm:p-6 border-b border-border">
          <div className="min-w-0">
            <h3
              className="text-lg sm:text-xl font-bold font-display uppercase text-fg"
              id={titleId}
            >
              {title}
            </h3>
            {subtitle ? (
              <div className="text-xs text-muted mt-1">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-muted hover:text-fg text-2xl leading-none disabled:opacity-40 shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>

        {footer ? (
          <div className="p-4 sm:p-6 border-t border-border bg-sidebar/40 rounded-b-2xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The primary submit button, with its own busy state. */
export function SubmitButton({
  children,
  submitting,
  disabled,
  type = "submit",
  onClick,
  className = "",
  form,
}: {
  children: ReactNode;
  submitting?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
  /**
   * Id of the form this button submits. Needed because the dialog's actions sit
   * in a footer outside the `<form>` element.
   */
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      // Disabled while in flight, which is what stops a double-click creating
      // the record twice.
      disabled={submitting || disabled}
      className={`bg-sweat text-black font-bold px-5 py-3 rounded-lg hover:bg-yellow-400 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${className}`}
    >
      {submitting ? (
        <>
          <i className="fas fa-circle-notch fa-spin" aria-hidden />
          Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
  form,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "submit" | "button";
  className?: string;
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      className={`bg-fg/5 hover:bg-fg/10 text-fg px-5 py-3 rounded-lg text-sm border border-border transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * A yes/no confirmation, replacing `window.confirm` for destructive actions so
 * the question is styled like the rest of the portal and can explain itself.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} busy={busy}>
      <div className="text-sm text-fg-soft leading-relaxed">{message}</div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <SecondaryButton onClick={onCancel} disabled={busy}>
          Cancel
        </SecondaryButton>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`px-5 py-3 rounded-lg font-bold transition disabled:opacity-60 inline-flex items-center justify-center gap-2 ${
            destructive
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-sweat hover:bg-yellow-400 text-black"
          }`}
        >
          {busy ? (
            <>
              <i className="fas fa-circle-notch fa-spin" aria-hidden />
              Working…
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
