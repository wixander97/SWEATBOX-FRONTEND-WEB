"use client";

import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

export type SystemSetting = {
  id: string;
  key: string;
  value: string;
  description: string;
};

type Props = {
  setting: SystemSetting;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditSettingModal({ setting, onClose, onSuccess }: Props) {
  const [value, setValue] = useState(setting.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/system-settings/${setting.key}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "Failed to update setting");
        return;
      }
      onSuccess();
    } catch {
      setError("Failed to update setting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target && !saving) onClose();
      }}
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-display uppercase text-white">
            Edit Setting
          </h3>
          {!saving && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
              Key
            </label>
            <input
              type="text"
              value={setting.key}
              readOnly
              className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
              Description
            </label>
            <input
              type="text"
              value={setting.description}
              readOnly
              className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
              Value <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sweat"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-sidebar border border-border text-gray-300 px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-sweat text-black px-4 py-2.5 rounded-lg font-semibold hover:bg-yellow-400 transition text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
