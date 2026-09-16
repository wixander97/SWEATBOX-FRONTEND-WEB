"use client";

import type { ReactNode } from "react";

/**
 * The three things a table can be showing besides rows.
 *
 * Every list screen needs all three — loading, empty and failed — and telling
 * them apart matters: "no workouts yet" and "we could not load the workouts"
 * call for completely different reactions from the person at the desk.
 */

export function TableStateRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td className="px-6 py-10" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  );
}

export function LoadingState({ colSpan }: { colSpan: number }) {
  return (
    <TableStateRow colSpan={colSpan}>
      <div className="flex items-center justify-center gap-3 text-muted text-sm">
        <i className="fas fa-circle-notch fa-spin text-accent-ink" aria-hidden />
        Loading…
      </div>
    </TableStateRow>
  );
}

export function ErrorState({
  colSpan,
  message,
  onRetry,
}: {
  colSpan: number;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <TableStateRow colSpan={colSpan}>
      <div className="flex flex-col items-center gap-3 text-center">
        <i
          className="fas fa-circle-exclamation text-danger text-2xl"
          aria-hidden
        />
        <p className="text-sm text-danger max-w-md">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-fg bg-fg/5 hover:bg-fg/10 border border-border px-4 py-2 rounded-lg"
          >
            Try again
          </button>
        ) : null}
      </div>
    </TableStateRow>
  );
}

export function EmptyState({
  colSpan,
  icon = "fa-inbox",
  title,
  description,
  action,
}: {
  colSpan: number;
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <TableStateRow colSpan={colSpan}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-14 h-14 rounded-full bg-fg/10 flex items-center justify-center text-muted text-xl mb-1">
          <i className={`fas ${icon}`} aria-hidden />
        </div>
        <p className="text-sm font-bold text-fg">{title}</p>
        {description ? (
          <p className="text-xs text-muted max-w-sm">{description}</p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </TableStateRow>
  );
}

/** Previous / next paging, matching the controls already on the class list. */
export function Pagination({
  page,
  totalPages,
  totalItems,
  loading,
  onChange,
  label = "records",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  loading?: boolean;
  onChange: (page: number) => void;
  label?: string;
}) {
  return (
    <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-xs text-muted">
        Page {page} of {Math.max(1, totalPages)} • {totalItems} {label}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onChange(Math.max(1, page - 1))}
          className="bg-sidebar border border-border text-fg px-3 py-1.5 rounded text-xs disabled:opacity-50"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          className="bg-sidebar border border-border text-fg px-3 py-1.5 rounded text-xs disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** The card shell every list screen sits in. */
export function PanelCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card rounded-xl border border-border overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
