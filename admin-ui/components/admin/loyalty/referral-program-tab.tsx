"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Field, FormError, InfoNote, ToggleRow, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/contexts/role-context";
import {
  QUALIFICATION_LABELS,
  getReferralSettings,
  updateReferralSettings,
  type ReferralSettings,
} from "@/lib/api/customer-benefits";
import { errorMessageOf } from "@/lib/api/http";
import {
  DateRangeFields,
  ProgramStatusPill,
  ReasonField,
  SettingsLoadError,
  SettingsLoading,
  settingDate,
} from "./benefit-shared";
import { SettingsHistory } from "./settings-history";

type FormState = {
  isEnabled: boolean;
  refereePoints: number;
  referrerPoints: number;
  qualificationEvent: string;
  codePrefix: string;
  codeLength: number;
  startDate: string;
  endDate: string;
  noEnd: boolean;
};

const DEFAULT_EVENTS = ["FirstSuccessfulTransaction", "FirstMembershipPurchase", "Registration"];

function toForm(s: ReferralSettings): FormState {
  const end = settingDate(s.endDate);
  return {
    isEnabled: s.isEnabled,
    refereePoints: s.refereePoints,
    referrerPoints: s.referrerPoints,
    qualificationEvent: s.qualificationEvent,
    codePrefix: s.codePrefix,
    codeLength: s.codeLength,
    startDate: settingDate(s.startDate),
    endDate: end,
    noEnd: !end,
  };
}

function cleanPrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

/** Referral programme configuration (`GET/PUT /api/v1/customer-benefits/referral/settings`). */
export function ReferralProgramTab() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("loyalty.write");

  const [saved, setSaved] = useState<ReferralSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const settings = await getReferralSettings();
      setSaved(settings);
      setForm(toForm(settings));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessageOf(err, "Failed to load referral settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || saving) return;

    const isWhole = (n: number) => Number.isInteger(n) && n >= 0;
    if (!isWhole(form.refereePoints) || !isWhole(form.referrerPoints)) {
      setError("Reward points must be whole numbers of 0 or more.");
      return;
    }
    const prefix = cleanPrefix(form.codePrefix);
    if (!prefix) {
      setError("The code prefix must contain letters or digits (A–Z, 0–9).");
      return;
    }
    if (!Number.isInteger(form.codeLength) || form.codeLength < 4 || form.codeLength > 12) {
      setError("Code length must be between 4 and 12.");
      return;
    }
    const end = form.noEnd ? "" : form.endDate;
    if (!form.noEnd && !end) {
      setError("Pick a campaign end date, or tick \"No end date\".");
      return;
    }
    if (form.startDate && end && end < form.startDate) {
      setError("The campaign end must be on or after its start.");
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
      const result = await updateReferralSettings({
        isEnabled: form.isEnabled,
        refereePoints: form.refereePoints,
        referrerPoints: form.referrerPoints,
        qualificationEvent: form.qualificationEvent,
        codePrefix: prefix,
        codeLength: form.codeLength,
        startDate: form.startDate || null,
        endDate: end || null,
        reason: reason.trim(),
      });
      setSaved(result);
      setForm(toForm(result));
      setReason("");
      setHistoryKey((k) => k + 1);
      toast.success("Referral programme saved");
    } catch (err) {
      setError(errorMessageOf(err, "Failed to save referral settings"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SettingsLoading />;

  if (loadError || !form || !saved) {
    return (
      <SettingsLoadError
        message={loadError ?? "Failed to load referral settings"}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      />
    );
  }

  const disabled = !canWrite;
  const events =
    saved.availableQualificationEvents && saved.availableQualificationEvents.length > 0
      ? saved.availableQualificationEvents
      : DEFAULT_EVENTS;

  return (
    <div>
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display uppercase font-bold text-fg">Referral programme</h3>
          <ProgramStatusPill
            isEnabled={saved.isEnabled}
            isActiveNow={saved.isActiveNow}
            startDate={saved.startDate}
            endDate={saved.endDate}
          />
        </div>

        <InfoNote>
          Existing codes never change; referrals already pending keep the qualification event
          they started with; rewarded referrals keep their points.
        </InfoNote>

        <ToggleRow
          id="ref-enabled"
          label="Status"
          description={
            form.isEnabled
              ? "On — customers can share codes and earn rewards."
              : "Off — new codes can't be applied and no new rewards are given."
          }
          checked={form.isEnabled}
          disabled={disabled}
          onChange={(v) => set("isEnabled", v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="New customer reward" htmlFor="ref-referee" hint="Points for the customer who signs up with a code.">
            <div className="relative">
              <input
                id="ref-referee"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                disabled={disabled}
                className={`${inputClass()} pr-16`}
                value={Number.isFinite(form.refereePoints) ? form.refereePoints : ""}
                onChange={(e) => set("refereePoints", Number(e.target.value))}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm">points</span>
            </div>
          </Field>
          <Field label="Referrer reward" htmlFor="ref-referrer" hint="Points for the existing customer who shared the code.">
            <div className="relative">
              <input
                id="ref-referrer"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                disabled={disabled}
                className={`${inputClass()} pr-16`}
                value={Number.isFinite(form.referrerPoints) ? form.referrerPoints : ""}
                onChange={(e) => set("referrerPoints", Number(e.target.value))}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm">points</span>
            </div>
          </Field>
        </div>

        <Field
          label="Qualification event"
          htmlFor="ref-event"
          hint="When a referral counts as successful and both rewards are granted."
        >
          <select
            id="ref-event"
            disabled={disabled}
            className={inputClass()}
            value={form.qualificationEvent}
            onChange={(e) => set("qualificationEvent", e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev} value={ev}>
                {QUALIFICATION_LABELS[ev] ?? ev}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Code prefix" htmlFor="ref-prefix" hint="Letters and digits only (A–Z, 0–9), up to 10.">
            <input
              id="ref-prefix"
              type="text"
              disabled={disabled}
              maxLength={10}
              className={`${inputClass()} font-mono uppercase`}
              value={form.codePrefix}
              onChange={(e) => set("codePrefix", cleanPrefix(e.target.value))}
            />
          </Field>
          <Field label="Code length" htmlFor="ref-length" hint="Random characters after the prefix (4–12).">
            <input
              id="ref-length"
              type="number"
              min={4}
              max={12}
              step={1}
              disabled={disabled}
              className={inputClass()}
              value={Number.isFinite(form.codeLength) ? form.codeLength : ""}
              onChange={(e) => set("codeLength", Math.floor(Number(e.target.value)))}
            />
          </Field>
        </div>
        <p className="text-xs text-muted -mt-2">
          New codes look like{" "}
          <span className="font-mono text-accent-ink">
            {cleanPrefix(form.codePrefix) || "PREFIX"}
            {"X".repeat(Math.min(12, Math.max(0, form.codeLength || 0)))}
          </span>
        </p>

        <DateRangeFields
          idPrefix="ref"
          startLabel="Campaign start"
          endLabel="Campaign end"
          start={form.startDate}
          end={form.endDate}
          noEnd={form.noEnd}
          disabled={disabled}
          onStart={(v) => set("startDate", v)}
          onEnd={(v) => set("endDate", v)}
          onNoEnd={(v) => set("noEnd", v)}
        />

        {canWrite ? (
          <>
            <ReasonField
              id="ref-reason"
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

      <SettingsHistory area="Referral" refreshKey={historyKey} />
    </div>
  );
}
