import { apiGet, toList, type PagedResponse, type RequestOptions } from "./http";

/**
 * System settings.
 *
 * Note the route: like the drop-in pass controller, this one answers on
 * `/api/system-settings` and **not** under `/api/v1`.
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
    { errorMessage: "Failed to load system settings", ...options }
  );
  return toList(payload);
}

/* -------------------------------------------------------------------------
   Drop-in configuration
   ------------------------------------------------------------------------- */

/**
 * A drop-in product as configured in System Settings.
 *
 * This is the whole drop-in catalogue: there is no drop-in table and no
 * drop-in membership plan behind it. The backend prices a drop-in payment from
 * these very rows, which is why they are keyed per branch — the same single
 * visit is Rp 100.000 at Kedoya and Rp 150.000 at PIK2.
 *
 * Live keys look like this:
 *
 *   DROP_IN_SINGLE_KEDOYA                = 100000
 *   DROP_IN_SINGLE_KEDOYA_VISITS         = 1
 *   DROP_IN_SINGLE_KEDOYA_VALIDITY_DAYS  = 1
 *   DROP_IN_PASS_PIK2                    = 600000
 *   DROP_IN_PASS_PIK2_VISITS             = 5
 *   DROP_IN_PASS_PIK2_VALIDITY_DAYS      = 30
 *
 * The price row is the bare key; `_VISITS` and `_VALIDITY_DAYS` describe it.
 */
export type DropInSettingOption = {
  /** Setting key the price came from — the stable identity of the option. */
  key: string;
  label: string;
  kind: "single" | "pass";
  visits: number;
  price: number;
  validityDays?: number;
  /**
   * Branch part of the key ("KEDOYA", "PIK2"), normalized. Empty when the key
   * names no branch, in which case the option applies to every branch.
   */
  branchToken: string;
};

export type DropInSettingsResult = {
  options: DropInSettingOption[];
  /** Explicitly switched off by a `DROP_IN_..._ENABLED = false` style setting. */
  disabled: boolean;
  /** Rows that look drop-in related but could not be used. */
  warnings: string[];
};

/** "PIK 2" / "pik2" / "PIK-2" all normalise to "PIK2". */
export function normalizeToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function tokensOf(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // dropInSingleKedoya → drop_In_Single_Kedoya
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toUpperCase());
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
    if (keys.includes(normalizeToken(key).toLowerCase())) return record[key];
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
 * Not how the live settings are written, but cheap to support and the shape an
 * admin reaches for when adding a third tier:
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
    const kindText = typeof kindRaw === "string" ? normalizeToken(kindRaw) : "";
    const kind = kindText.includes("SINGLE")
      ? "single"
      : kindText.includes("PASS")
        ? "pass"
        : visits > 1
          ? "pass"
          : "single";
    const nameRaw = pick(record, ["name", "label", "title", "planname"]);
    const branchRaw = pick(record, ["branch", "branchname", "branchcode"]);
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
      branchToken: typeof branchRaw === "string" ? normalizeToken(branchRaw) : "",
    });
  });

  return options.length > 0 ? options : null;
}

/** Tokens that mark what a row *is* rather than which product it belongs to. */
const VISITS_SUFFIX = ["VISITS", "VISIT", "KUNJUNGAN"];
const VALIDITY_SUFFIX = ["VALIDITY", "EXPIRY", "DURATION", "DAYS", "DAY", "MASABERLAKU"];
const PRICE_SUFFIX = ["PRICE", "FEE", "COST", "AMOUNT", "RATE", "HARGA", "TARIF"];
const ENABLED_SUFFIX = ["ENABLED", "ENABLE", "ACTIVE", "AKTIF"];

type Row = {
  setting: SystemSetting;
  /** What the row states: the price itself, or a property of it. */
  role: "price" | "visits" | "validity" | "enabled";
  /** Identity of the product: kind + branch, e.g. "SINGLE|KEDOYA". */
  base: string;
  kind: "single" | "pass" | null;
  branchToken: string;
};

function classify(setting: SystemSetting): Row | null {
  const tokens = tokensOf(setting.key ?? "");
  // "DROP", "IN", … or "DROPIN", …
  if (tokens[0] !== "DROPIN" && !(tokens[0] === "DROP" && tokens[1] === "IN")) return null;
  const rest = tokens[0] === "DROPIN" ? tokens.slice(1) : tokens.slice(2);

  let role: Row["role"] = "price";
  const trailing = [...rest];
  // Suffixes are read off the end: DROP_IN_PASS_KEDOYA_VALIDITY_DAYS.
  while (trailing.length > 0) {
    const last = trailing[trailing.length - 1];
    if (VISITS_SUFFIX.includes(last)) {
      role = "visits";
      trailing.pop();
      continue;
    }
    if (VALIDITY_SUFFIX.includes(last)) {
      if (role === "price") role = "validity";
      trailing.pop();
      continue;
    }
    if (ENABLED_SUFFIX.includes(last)) {
      role = "enabled";
      trailing.pop();
      continue;
    }
    if (PRICE_SUFFIX.includes(last)) {
      trailing.pop();
      continue;
    }
    break;
  }

  const kind = trailing.includes("SINGLE")
    ? "single"
    : trailing.includes("PASS") || trailing.includes("MULTI") || trailing.includes("BUNDLE")
      ? "pass"
      : null;
  const branchToken = trailing
    .filter((t) => !["SINGLE", "PASS", "MULTI", "BUNDLE", "PAKET", "PACKAGE"].includes(t))
    .join("");

  return { setting, role, base: `${kind ?? ""}|${branchToken}`, kind, branchToken };
}

/**
 * Read the drop-in menu out of the settings the gym actually configured.
 *
 * Rows are grouped by what they describe — kind plus branch — so
 * `DROP_IN_PASS_KEDOYA`, `DROP_IN_PASS_KEDOYA_VISITS` and
 * `DROP_IN_PASS_KEDOYA_VALIDITY_DAYS` become one option. Key spelling is read
 * token by token rather than matched literally, so a rename that keeps the
 * meaning ("DROP_IN_SINGLE_PIK2_PRICE", "dropInPassKedoya") still works.
 *
 * Anything drop-in shaped that cannot be turned into a sellable option is
 * reported through `warnings` instead of vanishing.
 */
export function dropInOptionsFromSettings(
  settings: SystemSetting[]
): DropInSettingsResult {
  const warnings: string[] = [];
  const rows = settings
    .map(classify)
    .filter((row): row is Row => row !== null);

  if (rows.length === 0) return { options: [], disabled: false, warnings };

  for (const setting of settings) {
    const fromJson = classify(setting) ? optionsFromJson(setting) : null;
    if (fromJson) return { options: fromJson, disabled: false, warnings };
  }

  const disabledBases = new Set(
    rows.filter((r) => r.role === "enabled" && isFalsy(r.setting.value ?? "")).map((r) => r.base)
  );
  // A bare DROP_IN_ENABLED = false switches drop-ins off everywhere.
  if (disabledBases.has("|")) return { options: [], disabled: true, warnings };

  const byBase = new Map<string, Row[]>();
  for (const row of rows) {
    const group = byBase.get(row.base);
    if (group) group.push(row);
    else byBase.set(row.base, [row]);
  }

  const options: DropInSettingOption[] = [];
  for (const [base, group] of byBase) {
    if (disabledBases.has(base)) continue;
    const priceRow = group.find((r) => r.role === "price");
    if (!priceRow) continue;

    const price = toNumber(priceRow.setting.value);
    if (price == null || price <= 0) {
      warnings.push(
        `${priceRow.setting.key} is not a valid price number ("${priceRow.setting.value}").`
      );
      continue;
    }

    const visitsRow = group.find((r) => r.role === "visits");
    const visitsValue = visitsRow ? toNumber(visitsRow.setting.value) : null;
    const visits =
      visitsValue != null && visitsValue > 0
        ? Math.floor(visitsValue)
        : priceRow.kind === "pass"
          ? 0
          : 1;

    if (priceRow.kind === "pass" && visits <= 1) {
      warnings.push(
        `${priceRow.setting.key} is a multi-visit pass but its visit count is not set in settings.`
      );
      continue;
    }

    const validityRow = group.find((r) => r.role === "validity");
    const validityValue = validityRow ? toNumber(validityRow.setting.value) : null;
    const kind = priceRow.kind ?? (visits > 1 ? "pass" : "single");

    options.push({
      key: priceRow.setting.key,
      label: labelFor(kind, visits),
      kind,
      visits,
      price,
      validityDays:
        validityValue != null && validityValue > 0 ? Math.floor(validityValue) : undefined,
      branchToken: priceRow.branchToken,
    });
  }

  // Cheapest first: the single visit is what most walk-ins buy.
  options.sort((a, b) => a.visits - b.visits || a.price - b.price);
  return { options, disabled: false, warnings };
}
