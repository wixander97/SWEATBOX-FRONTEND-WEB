"use client";

import type { ReactNode } from "react";

/**
 * The form control styling the admin portal already uses, in one place.
 *
 * The classes are lifted verbatim from the existing class and customer modals
 * so a new form is visually identical to the ones already shipped.
 */

export const FIELD_CLASS =
  "w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat disabled:opacity-60 disabled:cursor-not-allowed";

export const LABEL_CLASS = "block text-gray-400 text-sm mb-1";

export const INVALID_FIELD_CLASS =
  "w-full bg-sidebar border border-red-500/70 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-red-400";

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  /** Renders the `*` marker and is read out by assistive tech. */
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={className}>
      <label className={LABEL_CLASS} htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-sweat ml-1" aria-hidden>
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

export function inputClass(hasError?: boolean) {
  return hasError ? INVALID_FIELD_CLASS : FIELD_CLASS;
}

/** The boxed explanation used where a field needs more than a one-line hint. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-gray-400 bg-sweat/5 border border-sweat/20 rounded-lg px-3 py-2">
      <i className="fas fa-circle-info text-sweat mr-2" aria-hidden />
      {children}
    </p>
  );
}

/** The inline error banner shown at the foot of a form. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded"
    >
      {message}
    </p>
  );
}

/** A labelled on/off control, styled as a row rather than a bare checkbox. */
export function ToggleRow({
  id,
  name,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  name?: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 bg-sidebar border border-border rounded-lg px-4 py-3 ${
        disabled ? "opacity-60" : "cursor-pointer hover:border-gray-600"
      }`}
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-[#ffd700] shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm text-white font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-gray-500 mt-0.5">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
