"use client";

import { useCallback, useState } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SelectOption } from "@/components/admin/pt/pt-types";

type Props = {
  memberOptions: SelectOption[];
  onClose: () => void;
  onSubmit: (memberId: string) => Promise<void>;
};

export function AddPtSessionParticipantModal({ memberOptions, onClose, onSubmit }: Props) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!memberId) {
        setError("Member is required");
        return;
      }
      setSaving(true);
      try {
        await onSubmit(memberId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add member");
      } finally {
        setSaving(false);
      }
    },
    [memberId, onSubmit]
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-display uppercase text-white">Add Member</h3>
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
              Member
            </label>
            <SearchableSelect
              options={memberOptions}
              value={memberId}
              onChange={setMemberId}
              getOptionValue={(o) => o.id}
              getOptionLabel={(o) => o.label}
              placeholder="Pilih member..."
              searchPlaceholder="Cari member..."
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
              disabled={saving || !memberId}
              className="flex-1 bg-sweat text-black px-4 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
