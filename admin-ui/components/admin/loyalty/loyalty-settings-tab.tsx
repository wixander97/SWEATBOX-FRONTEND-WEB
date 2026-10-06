"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FormError, InfoNote, ToggleRow, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/contexts/role-context";
import { errorMessageOf } from "@/lib/api/http";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { formatCurrency } from "@/lib/format";
import {
  getLoyaltySettings,
  updateLoyaltySettings,
  type LoyaltySettings,
} from "@/lib/api/loyalty";
import { ReasonField } from "./benefit-shared";
import { SettingsHistory } from "./settings-history";

/** Overview & earning rule (`GET/PUT /api/v1/loyalty/settings`). */
export function LoyaltySettingsTab() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("loyalty.write");

  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setSettings(await getLoyaltySettings());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessageOf(err, "Failed to load loyalty settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof LoyaltySettings>(key: K, value: LoyaltySettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings || saving) return;
    if (!(settings.amountPerPoint > 0)) {
      setError("The amount per point must be above zero.");
      return;
    }
    if (!Number.isInteger(settings.pointsPerUnit) || settings.pointsPerUnit < 1) {
      setError("Points must be a whole number of at least 1.");
      return;
    }
    if (!reason.trim()) {
      setReasonError("Please give a reason for this change.");
      setError(null);
      return;
    }
    setError(null);
    setReasonError(null);
    setSaving(true);
    try {
      const saved = await updateLoyaltySettings({
        isEnabled: settings.isEnabled,
        amountPerPoint: settings.amountPerPoint,
        pointsPerUnit: settings.pointsPerUnit,
        reverseOnRefund: settings.reverseOnRefund,
        reason: reason.trim(),
      });
      setSettings(saved);
      setReason("");
      setHistoryKey((k) => k + 1);
      toast.success("Loyalty settings saved");
    } catch (err) {
      setError(errorMessageOf(err, "Failed to save loyalty settings"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 text-muted text-sm py-10">
        <i className="fas fa-circle-notch fa-spin text-accent-ink" aria-hidden />
        Loading…
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-danger">{loadError ?? "Failed to load loyalty settings"}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="text-xs text-fg bg-fg/5 hover:bg-fg/10 border border-border px-4 py-2 rounded-lg"
        >
          Try again
        </button>
      </div>
    );
  }

  const example = 250_000;
  const examplePoints =
    settings.amountPerPoint > 0
      ? Math.floor(example / settings.amountPerPoint) * settings.pointsPerUnit
      : 0;

  return (
    <div>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <div>
          <h3 className="font-display uppercase font-bold text-fg mb-2">Earning rule</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-fg">
            <span>Every</span>
            <div className="relative w-44">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Amount per earning unit"
                disabled={!canWrite}
                className={`${inputClass()} pl-10`}
                value={formatCurrencyInput(settings.amountPerPoint)}
                onChange={(e) => set("amountPerPoint", parseCurrencyInput(e.target.value))}
              />
            </div>
            <span>earns</span>
            {/* Sized by the wrapper: the shared field class is `w-full`. */}
            <div className="w-24">
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                aria-label="Points per earning unit"
                disabled={!canWrite}
                className={inputClass()}
                value={Number.isFinite(settings.pointsPerUnit) ? settings.pointsPerUnit : ""}
                onChange={(e) => set("pointsPerUnit", Math.floor(Number(e.target.value)))}
              />
            </div>
            <span>point(s)</span>
          </div>
          <p className="text-xs text-muted mt-2">
            Example: a paid {formatCurrency(example)} earns {examplePoints} point
            {examplePoints === 1 ? "" : "s"}.
          </p>
        </div>

        <InfoNote>
          Points are rounded down and earned on the amount actually paid, once the payment is
          Paid.
        </InfoNote>

        <div className="space-y-2">
          <ToggleRow
            id="loyalty-enabled"
            label="Programme enabled"
            description="Off stops new points being earned. Existing balances and vouchers are kept."
            checked={settings.isEnabled}
            disabled={!canWrite}
            onChange={(v) => set("isEnabled", v)}
          />
          <ToggleRow
            id="loyalty-reverse"
            label="Reverse points on refund"
            description="A refunded payment takes back the points it earned."
            checked={settings.reverseOnRefund}
            disabled={!canWrite}
            onChange={(v) => set("reverseOnRefund", v)}
          />
        </div>

        {canWrite ? (
          <>
            <ReasonField
              id="loyalty-reason"
              value={reason}
              error={reasonError}
              onChange={(v) => {
                setReason(v);
                if (v.trim()) setReasonError(null);
              }}
            />
            <FormError message={error} />
            <div className="flex justify-end">
              <SubmitButton submitting={saving}>
                <i className="fas fa-save" aria-hidden />
                Save Settings
              </SubmitButton>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">Only Admin and Super Admin can change these settings.</p>
        )}
      </form>

      <SettingsHistory area="Loyalty" refreshKey={historyKey} />
    </div>
  );
}
