import { apiGet, toList, type PagedResponse, type RequestOptions } from "./http";

/**
 * System settings.
 *
 * Note the route: like the drop-in pass controller, this one answers on
 * `/api/system-settings` and **not** under `/api/v1`.
 *
 * Settings are free-form key/value rows an admin edits from the System Settings
 * screen, so nothing here may assume an exact key spelling. Everything below
 * reads the rows the way a human would — by what the key is *about* — which is
 * what lets the drop-in menu follow the settings the gym actually configured
 * instead of a name hard-coded here.
 */
export type SystemSetting = {
  id: string;
  key: string;
  value: string;
  description?: string | null;
};

export async function listSystemSettings(
  options?: RequestOptions
): Promise<SystemSetting[]> {
  const payload = await apiGet<SystemSetting[] | PagedResponse<SystemSetting>>(
    "/api/system-settings",
    { errorMessage: "Gagal memuat system settings", ...options }
  );
  return toList(payload);
}

/* -------------------------------------------------------------------------
   Drop-in configuration
   ------------------------------------------------------------------------- */

/** A drop-in product as configured in System Settings. */
export type DropInSettingOption = {
  /** Setting key it was derived from — the stable identity of the option. */
  key: string;
  label: string;
  kind: "single" | "pass";
  visits: number;
  price: number;
  validityDays?: number;
};

export type DropInSettingsResult = {
  options: DropInSettingOption[];
  /** Explicitly switched off by a `DropIn...Enabled = false` style setting. */
  disabled: boolean;
  /** Settings that look drop-in related but could not be used. */
  warnings: string[];
};

/** "Drop In Pass Price" / "DROPIN_PASS_PRICE" / "dropInPassPrice" → "dropinpassprice". */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  // Accepts "150000", "150.000", "Rp 150,000" — the separators an admin types.
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(/[.,](?=\d{3}\b)/g, "");
  const parsed = Number(cleaned.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isFalsy(value: string): boolean {
  return ["false", "0", "no", "off", "disabled"].includes(value.trim().toLowerCase());
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of Object.keys(record)) {
    if (keys.includes(normalizeKey(key))) return record[key];
  }
  return undefined;
}

function labelFor(kind: "single" | "pass", visits: number): string {
  if (kind === "single") return "Single visit";
  return visits > 1 ? `${visits}x visit pass` : "Multi visit pass";
}

/**
 * Drop-in options carried in one setting as a JSON array.
 *
 * The tidiest way for an admin to configure several tiers, and the shape the
 * member app would read the same way:
 * `[{ "name": "5x Pass", "price": 400000, "visits": 5, "validityDays": 30 }]`.
 */
function optionsFromJson(setting: SystemSetting): DropInSettingOption[] | null {
  const trimmed = setting.value?.trim();
  if (!trimmed || !(trimmed.startsWith("[") || trimmed.startsWith("{"))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>).options)
      ? ((parsed as Record<string, unknown>).options as unknown[])
      : null;
  if (!rows) return null;

  const options: DropInSettingOption[] = [];
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const record = row as Record<string, unknown>;
    const price = toNumber(pick(record, ["price", "amount", "fee", "cost"]));
    if (price == null || price <= 0) return;

    const visitsRaw = toNumber(
      pick(record, ["visits", "visit", "totalvisits", "visitcount", "quantity", "credits"])
    );
    const visits = visitsRaw != null && visitsRaw > 0 ? Math.floor(visitsRaw) : 1;
    const kindRaw = pick(record, ["kind", "type", "category"]);
    const kind =
      typeof kindRaw === "string" && normalizeKey(kindRaw).includes("single")
        ? "single"
        : typeof kindRaw === "string" && normalizeKey(kindRaw).includes("pass")
          ? "pass"
          : visits > 1
            ? "pass"
            : "single";
    const nameRaw = pick(record, ["name", "label", "title", "planname"]);
    const validity = toNumber(
      pick(record, ["validitydays", "validdays", "expirydays", "durationdays", "days"])
    );

    options.push({
      key: `${setting.key}[${index}]`,
      label: typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : labelFor(kind, visits),
      kind,
      visits,
      price,
      validityDays: validity != null && validity > 0 ? Math.floor(validity) : undefined,
    });
  });

  return options.length > 0 ? options : null;
}

const PRICE_TOKENS = ["price", "fee", "cost", "amount", "rate", "tarif", "harga"];
const PASS_TOKENS = ["pass", "multi", "bundle", "package", "paket"];

function isPriceKey(normalized: string): boolean {
  return PRICE_TOKENS.some((token) => normalized.includes(token));
}

function visitsInKey(normalized: string): number | null {
  const digits = /(\d+)/.exec(normalized);
  if (!digits) return null;
  const parsed = Number(digits[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Read the drop-in menu out of whatever the gym configured.
 *
 * Two shapes are understood, in this order:
 *
 *  1. one setting holding a JSON array of tiers, and
 *  2. individual keys — `DropInPrice`, `DropInSingleVisitPrice`,
 *     `DropIn5VisitPrice`, `DropInPassPrice` + `DropInPassVisits`,
 *     `DropInValidityDays`, … — matched on what the key contains rather than
 *     on an exact spelling.
 *
 * Anything drop-in shaped that cannot be turned into a sellable option is
 * reported through `warnings` rather than dropped in silence, so a renamed key
 * shows up at the till as a message instead of as an empty menu.
 */
export function dropInOptionsFromSettings(
  settings: SystemSetting[]
): DropInSettingsResult {
  const warnings: string[] = [];
  const dropInRows = settings.filter((s) => normalizeKey(s.key ?? "").includes("dropin"));
  if (dropInRows.length === 0) {
    return { options: [], disabled: false, warnings };
  }

  const disabled = dropInRows.some((s) => {
    const normalized = normalizeKey(s.key);
    return (
      (normalized.includes("enabled") ||
        normalized.includes("active") ||
        normalized.includes("aktif")) &&
      isFalsy(s.value ?? "")
    );
  });
  if (disabled) return { options: [], disabled: true, warnings };

  for (const setting of dropInRows) {
    const fromJson = optionsFromJson(setting);
    if (fromJson) return { options: fromJson, disabled: false, warnings };
  }

  // Companion values that describe an option without being one themselves.
  const visitRows = dropInRows.filter((s) => {
    const n = normalizeKey(s.key);
    return !isPriceKey(n) && (n.includes("visit") || n.includes("kunjungan"));
  });
  const validityRows = dropInRows.filter((s) => {
    const n = normalizeKey(s.key);
    return (
      n.includes("validity") ||
      n.includes("expiry") ||
      n.includes("duration") ||
      n.includes("masaberlaku") ||
      (n.includes("day") && !isPriceKey(n))
    );
  });

  function companion(rows: SystemSetting[], wantPass: boolean): number | undefined {
    const preferred =
      rows.find((s) => {
        const n = normalizeKey(s.key);
        const isPass = PASS_TOKENS.some((t) => n.includes(t));
        return wantPass ? isPass : !isPass;
      }) ?? rows[0];
    const value = preferred ? toNumber(preferred.value) : null;
    return value != null && value > 0 ? Math.floor(value) : undefined;
  }

  const options: DropInSettingOption[] = [];
  for (const setting of dropInRows) {
    const normalized = normalizeKey(setting.key);
    if (!isPriceKey(normalized)) continue;

    const price = toNumber(setting.value);
    if (price == null || price <= 0) {
      warnings.push(`${setting.key} bukan angka harga yang valid ("${setting.value}").`);
      continue;
    }

    const looksLikePass = PASS_TOKENS.some((token) => normalized.includes(token));
    const visitsFromKey = visitsInKey(normalized);
    const visits =
      visitsFromKey ??
      (looksLikePass ? (companion(visitRows, true) ?? 0) : 1);

    if (looksLikePass && visits <= 1) {
      warnings.push(
        `${setting.key} terbaca sebagai multi-visit pass tapi jumlah kunjungannya tidak ada di settings.`
      );
      continue;
    }

    const kind: "single" | "pass" = visits > 1 ? "pass" : "single";
    options.push({
      key: setting.key,
      label: labelFor(kind, visits),
      kind,
      visits,
      price,
      validityDays: companion(validityRows, kind === "pass"),
    });
  }

  // Cheapest first: the single visit is what most walk-ins buy.
  options.sort((a, b) => a.visits - b.visits || a.price - b.price);
  return { options, disabled: false, warnings };
}
