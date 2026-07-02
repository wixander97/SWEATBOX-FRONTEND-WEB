"use client";

import { useCallback, useState } from "react";

type Props = {
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
};

export function CancelPtSessionModal({ onClose, onSubmit }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSaving(true);
      try {
        if (!reason.trim()) {
          setError("Reason wajib diisi");
          setSaving(false);
          return;
        }
        await onSubmit(reason.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to cancel session");
      } finally {
        setSaving(false);
      }
    },
    [reason, onSubmit]
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-display uppercase text-white">Cancel Session</h3>
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
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat resize-none"
              rows={3}
              placeholder="Alasan pembatalan..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-sidebar border border-border text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-red-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Cancelling..." : "Cancel Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
