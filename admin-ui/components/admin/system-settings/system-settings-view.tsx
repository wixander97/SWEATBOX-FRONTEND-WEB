"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import {
  EditSettingModal,
  type SystemSetting,
} from "./edit-setting-modal";

export function SystemSettingsView() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SystemSetting | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE_URL}/api/system-settings`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const data = (await res.json().catch(() => [])) as SystemSetting[];
      if (!res.ok) {
        setError("Failed to load system settings");
        setSettings([]);
        return;
      }
      setSettings(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load system settings");
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-bold text-white">
          System Settings
        </h2>
      </div>

      {loading ? (
        <div className="p-6 text-gray-400">Loading...</div>
      ) : error ? (
        <div className="p-6 text-red-400">{error}</div>
      ) : settings.length === 0 ? (
        <div className="p-6 text-gray-400">No settings found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm text-gray-400">
            <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
              <tr>
                <th className="px-6 py-4">Key</th>
                <th className="px-6 py-4">Value</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {settings.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition">
                  <td className="px-6 py-4 font-mono text-xs text-sweat font-semibold">
                    {s.key}
                  </td>
                  <td className="px-6 py-4 font-mono text-white">
                    {s.value}
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {s.description}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="text-xs text-gray-400 hover:text-white border border-border px-2 py-1 rounded transition"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditSettingModal
          setting={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            void loadSettings();
          }}
        />
      )}
    </div>
  );
}
