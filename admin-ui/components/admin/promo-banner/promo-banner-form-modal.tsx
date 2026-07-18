"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  REDIRECT_TYPES,
  type ApiPromoBanner,
} from "@/components/admin/promo-banner/promo-banners.types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Converts an ISO string (e.g. 2026-07-17T13:23:11.575Z) into the local
// datetime-local input value (YYYY-MM-DDTHH:MM).
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

// Converts a datetime-local value back to an ISO 8601 UTC string with
// milliseconds and Z suffix (e.g. 2026-07-17T13:23:00.000Z). Returns "" when empty/invalid.
function toIsoUtc(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  initialValues?: ApiPromoBanner | null;
  isEdit?: boolean;
};

export function PromoBannerFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  isEdit = false,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);
      try {
        const fd = new FormData(e.currentTarget);

        // Remove the file entry managed by the controlled input if present;
        // we re-append it explicitly only when a new file is chosen.
        fd.delete("image");

        const isActive = fd.get("IsActive") === "on";
        fd.set("IsActive", String(isActive));

        // RedirectType and DisplayOrder are optional integers but must be
        // submitted as strings. Empty strings are allowed by the backend.
        const redirectType = String(fd.get("RedirectType") ?? "");
        const displayOrder = String(fd.get("DisplayOrder") ?? "");
        if (redirectType === "") fd.delete("RedirectType");
        else fd.set("RedirectType", redirectType);
        if (displayOrder === "") fd.delete("DisplayOrder");
        else fd.set("DisplayOrder", displayOrder);

        // Omit empty dates so the backend keeps null.
        const startDate = toIsoUtc(String(fd.get("StartDate") ?? ""));
        const endDate = toIsoUtc(String(fd.get("EndDate") ?? ""));
        if (startDate === "") fd.delete("StartDate");
        else fd.set("StartDate", startDate);
        if (endDate === "") fd.delete("EndDate");
        else fd.set("EndDate", endDate);

        // Title is mandatory on both create and edit.
        const title = String(fd.get("Title") ?? "").trim();
        if (!title) {
          setError("Title is required");
          setSubmitting(false);
          return;
        }

        // Image is required on Create. On Edit it is optional; omitting it
        // preserves the existing imageUrl.
        if (!imageFile && !isEdit) {
          setError("Image is required");
          setSubmitting(false);
          return;
        }

        if (imageFile) {
          fd.append("image", imageFile);
        }

        await onSubmit(fd);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to submit";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [imageFile, isEdit, onClose, onSubmit]
  );

  if (!isOpen) return null;

  return (
    <div
      id="modal-overlay"
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
        id="modal-box"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h3
            className="text-xl font-bold font-display uppercase"
            id="modal-title"
          >
            {isEdit ? "Edit Promo Banner" : "Create New Promo Banner"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none shrink-0"
            aria-label="Close modal"
          >
            <i className="fas fa-times" aria-hidden />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Title
            </label>
            <input
              type="text"
              name="Title"
              defaultValue={initialValues?.title ?? ""}
              required
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
              placeholder="e.g. 50% OFF Purchase"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              name="Description"
              rows={3}
              defaultValue={initialValues?.description ?? ""}
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat resize-none"
              placeholder="Banner description"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Redirect Type
              </label>
              <select
                name="RedirectType"
                defaultValue={
                  initialValues?.redirectType != null
                    ? String(initialValues.redirectType)
                    : ""
                }
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
              >
                <option value="">—</option>
                {REDIRECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value} — {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Redirect Value
              </label>
              <input
                type="text"
                name="RedirectValue"
                defaultValue={initialValues?.redirectValue ?? ""}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                placeholder="e.g. Membership / URL"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Display Order
              </label>
              <input
                type="number"
                name="DisplayOrder"
                defaultValue={
                  initialValues?.displayOrder != null
                    ? String(initialValues.displayOrder)
                    : ""
                }
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                IsActive
              </label>
              <label className="flex items-center gap-2 h-[3.25rem]">
                <input
                  type="checkbox"
                  name="IsActive"
                  defaultChecked={initialValues?.isActive ?? true}
                  className="w-4 h-4 rounded border border-border bg-sidebar cursor-pointer accent-sweat"
                />
                <span className="text-sm text-gray-300">Active</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Start Date
              </label>
              <input
                type="datetime-local"
                name="StartDate"
                defaultValue={toDatetimeLocalValue(initialValues?.startDate)}
                step={1}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                End Date
              </label>
              <input
                type="datetime-local"
                name="EndDate"
                defaultValue={toDatetimeLocalValue(initialValues?.endDate)}
                step={1}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              name="image"
              accept="image/*"
              required={!isEdit}
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="w-full bg-sidebar border border-border text-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-sweat file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-sweat file:text-black file:font-bold file:cursor-pointer"
            />
            {isEdit && initialValues?.imageUrl && !imageFile && (
              <p className="mt-1.5 text-xs text-gray-500">
                Leave empty to keep the existing image.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-sidebar border border-border text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-sweat text-black px-4 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}