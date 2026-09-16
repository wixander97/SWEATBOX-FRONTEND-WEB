"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { Field, FormError, InfoNote, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { PanelCard } from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiRequest, errorMessage } from "@/lib/api/client";
import { useRole } from "@/contexts/role-context";
import type { Branch } from "@/lib/branches";
import {
  BRAND_FIELDS,
  DROP_IN_DISCOUNT_KEY,
  READ_ONLY_BRAND_FIELDS,
  brandBranchToken,
  brandKeyFor,
  toSettingMap,
  type BrandScope,
  type SystemSetting,
} from "@/lib/system-settings";

/**
 * Brand and letterhead configuration.
 *
 * These values are what the backend prints on invoices, receipts and the signed
 * agreement PDFs. They are kept per branch — PIK2 and Kedoya each have their
 * own rows — with a company-wide default underneath: a field a branch leaves
 * blank is printed from the default, so a document always names the club the
 * customer actually paid at without every detail being repeated per branch.
 *
 * The branch list comes from the branches API, so a new branch appears here
 * without a code change.
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
  const [branches, setBranches] = useState<Branch[]>([]);
  /** Which letterhead is being edited: "" is the company-wide default. */
  const [scopeId, setScopeId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [data, branchData] = await Promise.all([
        apiRequest<SystemSetting[]>("/api/system-settings"),
        // Without the branch list only the default letterhead can be edited,
        // which is exactly what the screen offered before.
        apiRequest<Branch[]>("/api/branches").catch(() => [] as Branch[]),
      ]);
      const list = Array.isArray(data) ? data : [];
      const activeBranches = (Array.isArray(branchData) ? branchData : []).filter(
        (b) => b.isActive
      );
      const map = toSettingMap(list);
      setSettings(map);
      setBranches(activeBranches);
      setValues(
        Object.fromEntries(
          [...brandKeys(activeBranches), DROP_IN_DISCOUNT_KEY].map((key) => [
            key,
            map[key]?.value ?? "",
          ])
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

  const scopes = useMemo(() => scopesFor(branches), [branches]);

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
      // Every scope is saved, so edits made on one branch tab are not lost by
      // switching to another before saving. Each key belongs to one scope, so
      // no scope's write can land on another's row.
      for (const scope of scopesFor(branches)) {
        for (const field of BRAND_FIELDS) {
          const key = brandKeyFor(field.key, scope);
          const current = settings[key]?.value ?? "";
          const next = values[key] ?? "";
          if (next === current) continue;
          await writeSetting(
            key,
            next,
            scope ? `${field.label} for ${scope.branchName}.` : field.hint
          );
        }
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

  const scope = scopes.find((s) => (s?.branchId ?? "") === scopeId) ?? null;
  const valueOf = (fieldKey: string, forScope: BrandScope) =>
    values[brandKeyFor(fieldKey, forScope)] ?? "";
  const logoUrl = (
    valueOf("BRAND_LOGO_URL", scope).trim() || valueOf("BRAND_LOGO_URL", null)
  ).trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg font-bold font-display uppercase text-fg">
            Brand &amp; Letterhead
          </h3>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Printed on invoices, receipts and the signed waiver and house rules.
            Each branch has its own letterhead; any field a branch leaves blank
            is printed from the default.
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {branches.length > 0 ? (
            <div
              role="tablist"
              aria-label="Letterhead scope"
              className="flex flex-wrap gap-2"
            >
              {scopes.map((s) => {
                const id = s?.branchId ?? "";
                const active = id === scopeId;
                return (
                  <button
                    key={id || "default"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setScopeId(id)}
                    className={`px-4 py-2 rounded-lg text-sm border transition ${
                      active
                        ? "bg-sweat text-black font-bold border-sweat"
                        : "bg-fg/5 hover:bg-fg/10 text-fg border-border"
                    }`}
                  >
                    {s ? s.branchName : "Default (all branches)"}
                  </button>
                );
              })}
            </div>
          ) : null}

          {scope ? (
            <InfoNote>
              Editing the letterhead for <strong>{scope.branchName}</strong>.
              Only this branch&apos;s documents use these values. Leave a field
              blank to print the default shown as its placeholder.
            </InfoNote>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {BRAND_FIELDS.map((field) => {
              const key = brandKeyFor(field.key, scope);
              const inputId = `bs-${key}`;
              const fallback = scope ? valueOf(field.key, null) : "";
              const placeholder = scope
                ? fallback || "Not set — uses server configuration"
                : undefined;
              return (
                <Field
                  key={key}
                  label={field.label}
                  htmlFor={inputId}
                  hint={
                    scope
                      ? `${scope.branchName} only. Blank uses the default.`
                      : field.hint
                  }
                  className={field.kind === "textarea" ? "lg:col-span-2" : ""}
                >
                  {field.kind === "textarea" ? (
                    <textarea
                      id={inputId}
                      rows={3}
                      className={inputClass()}
                      value={values[key] ?? ""}
                      placeholder={placeholder}
                      onChange={(e) => set(key, e.target.value)}
                      disabled={!canWrite}
                    />
                  ) : (
                    <input
                      id={inputId}
                      type={
                        field.kind === "email"
                          ? "email"
                          : field.kind === "url"
                            ? "url"
                            : "text"
                      }
                      className={inputClass()}
                      value={values[key] ?? ""}
                      placeholder={placeholder}
                      onChange={(e) => set(key, e.target.value)}
                      disabled={!canWrite}
                    />
                  )}
                </Field>
              );
            })}
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

/**
 * The default letterhead first, then one per branch. A branch whose name has no
 * letters or digits has no key of its own, so it is not offered rather than
 * silently editing the default.
 */
function scopesFor(branches: Branch[]): BrandScope[] {
  return [
    null,
    ...branches
      .filter((b) => brandBranchToken(b.branchName ?? "") !== "")
      .map((b) => ({ branchId: b.id, branchName: b.branchName })),
  ];
}

/** Every letterhead key across the default and every branch. */
function brandKeys(branches: Branch[]): string[] {
  return scopesFor(branches).flatMap((scope) =>
    BRAND_FIELDS.map((field) => brandKeyFor(field.key, scope))
  );
}
