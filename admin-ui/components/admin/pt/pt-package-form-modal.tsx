"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SelectOption } from "@/components/admin/pt/pt-types";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { formatCountInput, parseCountInput } from "@/lib/number-input";

export type PtPackageFormValues = {
  memberId: string;
  name: string;
  coachId: string;
  sessionCount: number;
  price: number;
  isActive: boolean;
  description: string;
};

type FormState = {
  memberId: string;
  name: string;
  coachId: string;
  sessionCount: number;
  price: number;
  isActive: boolean;
  description: string;
};

function emptyForm(): FormState {
  return {
    memberId: "",
    name: "",
    coachId: "",
    sessionCount: 0,
    price: 0,
    isActive: true,
    description: "",
  };
}

type Props = {
  title: string;
  submitLabel: string;
  isEdit?: boolean;
  coachOptions: SelectOption[];
  memberOptions: SelectOption[];
  initialValues?: Partial<PtPackageFormValues>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: PtPackageFormValues) => Promise<void>;
};

export function PtPackageFormModal({
  title,
  submitLabel,
  isEdit = false,
  coachOptions,
  memberOptions,
  initialValues,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    initialValues
      ? {
        memberId: initialValues.memberId ?? "",
        name: initialValues.name ?? "",
        coachId: initialValues.coachId ?? "",
        sessionCount: initialValues.sessionCount ?? 0,
        price: initialValues.price ?? 0,
        isActive: initialValues.isActive ?? true,
        description: initialValues.description ?? "",
      }
      : emptyForm()
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialValues) {
      setForm({
        memberId: initialValues.memberId ?? "",
        name: initialValues.name ?? "",
        coachId: initialValues.coachId ?? "",
        sessionCount: initialValues.sessionCount ?? 0,
        price: initialValues.price ?? 0,
        isActive: initialValues.isActive ?? true,
        description: initialValues.description ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [initialValues]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!form.memberId.trim()) {
        setError("Member is required");
        return;
      }
      if (!form.name.trim()) {
        setError("Name is required");
        return;
      }
      if (!form.coachId.trim()) {
        setError("Coach is required");
        return;
      }
      if (form.sessionCount === undefined || form.sessionCount === null || Number.isNaN(form.sessionCount)) {
        setError("Session count is required");
        return;
      }
      if (form.price === undefined || form.price === null || Number.isNaN(form.price)) {
        setError("Price is required");
        return;
      }
      if (!form.description.trim()) {
        setError("Description is required");
        return;
      }
      try {
        await onSubmit({ ...form });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit");
      }
    },
    [form, onSubmit]
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold font-display uppercase text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
            aria-label="Close"
          >
            <i className="fas fa-times" aria-hidden />
          </button>
        </div>

        {error && (
          <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
              Member <span className="text-red-400">*</span>
            </label>
            <SearchableSelect
              options={memberOptions}
              value={form.memberId || null}
              onChange={(v) => setForm((f) => ({ ...f, memberId: v ?? "" }))}
              getOptionValue={(o) => o.id}
              getOptionLabel={(o) => o.label}
              placeholder="Pilih member..."
              searchPlaceholder="Cari member..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
              Coach <span className="text-red-400">*</span>
            </label>
            <select
              value={form.coachId}
              onChange={(e) => setForm((f) => ({ ...f, coachId: e.target.value }))}
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
              required
            >
              <option value="">Pilih coach...</option>
              {coachOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Session Count <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCountInput(form.sessionCount)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessionCount: parseCountInput(e.target.value) }))
                }
                className="w-full bg-sidebar border border-border text-white pl-4 pr-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Price <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formatCurrencyInput(form.price)}
                onChange={(e) => {
                  const num = parseCurrencyInput(e.target.value);
                  setForm((f) => ({ ...f, price: num }));
                }}
                className="w-full bg-sidebar border border-border text-white pl-4 pr-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              />
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border border-border bg-sidebar cursor-pointer accent-sweat"
              />
              <span className="text-sm text-gray-300">Active</span>
            </label>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat resize-none"
              rows={3}
              required
            />
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
              disabled={saving}
              className="flex-1 bg-sweat text-black px-4 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
