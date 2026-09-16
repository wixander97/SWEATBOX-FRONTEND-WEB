"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Field, FormError, InfoNote, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { PanelCard } from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiRequest, errorMessage } from "@/lib/api/client";
import { useRole } from "@/contexts/role-context";
import {
  BRAND_FIELDS,
  DROP_IN_DISCOUNT_KEY,
  READ_ONLY_BRAND_FIELDS,
  toSettingMap,
  type SystemSetting,
} from "@/lib/system-settings";

/**
 * Brand and letterhead configuration.
 *
 * These values are what the backend prints on invoices, receipts and the signed
 * agreement PDFs. A branch that carries its own address and phone still wins
 * over them — an invoice has to name the club the customer actually paid at —
 * so these are the fallback and the company-wide details.
 *
 * Nothing secret is on this screen and nothing secret is ever fetched into it:
 * SMTP credentials, the Xendit secret key and webhook token, and the AsteriPay
 * merchant key stay in server configuration.
 */

export function SettingsView() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("settings.write");

  const [settings, setSettings] = useState<Record<string, SystemSetting>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiRequest<SystemSetting[]>("/api/system-settings");
      const list = Array.isArray(data) ? data : [];
      const map = toSettingMap(list);
      setSettings(map);
      setValues(
        Object.fromEntries(
          [...BRAND_FIELDS.map((f) => f.key), DROP_IN_DISCOUNT_KEY].map(
            (key) => [key, map[key]?.value ?? ""]
          )
        )
      );
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Writes one setting, creating it when it does not exist yet.
   *
   * The API updates by key and answers 404 for a key that was never written, so
   * a first-time brand value has to be created rather than updated.
   */
  async function writeSetting(key: string, value: string, description: string) {
    if (settings[key]) {
      await apiRequest(`/api/system-settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: { value },
      });
      return;
    }

    try {
      await apiRequest("/api/system-settings", {
        method: "POST",
        body: { key, value, description },
      });
    } catch (err) {
      // Another session may have created it between the load and this save.
      if (err instanceof ApiError && err.status === 409) {
        await apiRequest(`/api/system-settings/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: { value },
        });
        return;
      }
      throw err;
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !canWrite) return;

    const discount = values[DROP_IN_DISCOUNT_KEY];
    if (discount.trim()) {
      const parsed = Number(discount);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setError("The drop-in discount must be a percentage between 0 and 100.");
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      for (const field of BRAND_FIELDS) {
        const current = settings[field.key]?.value ?? "";
        if (values[field.key] === current) continue;
        await writeSetting(field.key, values[field.key], field.hint);
      }

      const currentDiscount = settings[DROP_IN_DISCOUNT_KEY]?.value ?? "";
      if (discount !== currentDiscount) {
        await writeSetting(
          DROP_IN_DISCOUNT_KEY,
          discount,
          "Discount applied to a Drop In or 1 Day Pass for a customer who already holds an active membership."
        );
      }

      toast.success("Settings saved.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
      toast.error("Could not save the settings", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PanelCard>
        <p className="p-8 text-center text-sm text-muted">
          <i className="fas fa-circle-notch fa-spin text-accent-ink mr-2" aria-hidden />
          Loading settings…
        </p>
      </PanelCard>
    );
  }

  if (loadError) {
    return (
      <PanelCard>
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-danger">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs text-fg bg-fg/5 hover:bg-fg/10 border border-border px-4 py-2 rounded-lg"
          >
            Try again
          </button>
        </div>
      </PanelCard>
    );
  }

  const logoUrl = values.BRAND_LOGO_URL?.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg font-bold font-display uppercase text-fg">
            Brand &amp; Letterhead
          </h3>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Printed on invoices, receipts and the signed waiver and house rules.
            A branch with its own address and phone number overrides these — the
            invoice names the club the customer actually paid at.
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {BRAND_FIELDS.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                htmlFor={`bs-${field.key}`}
                hint={field.hint}
                className={field.kind === "textarea" ? "lg:col-span-2" : ""}
              >
                {field.kind === "textarea" ? (
                  <textarea
                    id={`bs-${field.key}`}
                    rows={3}
                    className={inputClass()}
                    value={values[field.key] ?? ""}
                    onChange={(e) => set(field.key, e.target.value)}
                    disabled={!canWrite}
                  />
                ) : (
                  <input
                    id={`bs-${field.key}`}
                    type={
                      field.kind === "email"
                        ? "email"
                        : field.kind === "url"
                          ? "url"
                          : "text"
                    }
                    className={inputClass()}
                    value={values[field.key] ?? ""}
                    onChange={(e) => set(field.key, e.target.value)}
                    disabled={!canWrite}
                  />
                )}
              </Field>
            ))}
          </div>

          {logoUrl ? (
            <div className="rounded-xl border border-border bg-sidebar/40 p-4">
              <p className="text-xs text-muted mb-2">Logo preview</p>
              <Image
                src={logoUrl}
                alt="Brand logo preview"
                width={160}
                height={64}
                unoptimized
                className="max-h-16 w-auto object-contain bg-white rounded p-2"
                // A URL that cannot be fetched degrades to the brand name in
                // text on the real documents, so a broken preview is a warning,
                // not a failure.
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-sidebar/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Set in server configuration
            </p>
            <dl className="space-y-1 text-xs">
              {READ_ONLY_BRAND_FIELDS.map((field) => (
                <div key={field.configKey} className="flex justify-between gap-4">
                  <dt className="text-muted">{field.label}</dt>
                  <dd className="text-muted font-mono">{field.configKey}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted mt-2">
              These two have no System Settings override, so they are changed in
              the API&apos;s configuration rather than here. An input that
              silently saved nothing would be worse than saying so.
            </p>
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg font-bold font-display uppercase text-fg">
            Drop-In Member Discount
          </h3>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Applied by the backend to a Drop In or 1 Day Pass bought by a
            customer who already holds an active membership at either branch.
          </p>
        </div>
        <div className="p-4 sm:p-6 space-y-3">
          <Field
            label="Discount Percent"
            htmlFor="bs-discount"
            hint="Leave blank to use the default of 50%. Values outside 0–100 are ignored by the backend."
            className="max-w-xs"
          >
            <input
              id="bs-discount"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              className={inputClass()}
              value={values[DROP_IN_DISCOUNT_KEY] ?? ""}
              onChange={(e) => set(DROP_IN_DISCOUNT_KEY, e.target.value)}
              disabled={!canWrite}
              placeholder="50"
            />
          </Field>

          <InfoNote>
            This affects only the drop-in rails priced from System Settings. A
            plan in the catalogue carries its own member discount percentage,
            set on the plan itself.
          </InfoNote>
        </div>
      </PanelCard>

      <FormError message={error} />

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted">
          <i className="fas fa-shield-halved mr-1.5" aria-hidden />
          Payment keys, webhook tokens and SMTP credentials are never exposed to
          this portal.
        </p>
        {canWrite ? (
          <SubmitButton submitting={saving}>
            <i className="fas fa-save" aria-hidden />
            Save Settings
          </SubmitButton>
        ) : (
          <p className="text-xs text-muted">
            <i className="fas fa-lock mr-1.5" aria-hidden />
            View only for your role.
          </p>
        )}
      </div>
    </form>
  );
}
