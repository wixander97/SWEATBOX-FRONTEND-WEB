/**
 * Brand / letterhead configuration.
 *
 * The values live in System Settings, where they override the `Brand` section
 * of the API's configuration for every document the backend renders — invoices,
 * receipts and the signed agreement PDFs. The keys are the ones `PdfService`
 * reads; anything else written here would be ignored.
 *
 * Nothing secret belongs on this screen. SMTP credentials, the Xendit secret
 * key and webhook token, and the AsteriPay merchant key stay in server
 * configuration and are never read by the portal.
 */

export type SystemSetting = {
  id: string;
  key: string;
  value: string;
  description?: string | null;
};

export type BrandField = {
  key: string;
  label: string;
  hint: string;
  /** `url` renders a preview; `textarea` a multi-line box. */
  kind?: "text" | "url" | "textarea" | "email";
};

/** The letterhead fields System Settings can override. */
export const BRAND_FIELDS: BrandField[] = [
  {
    key: "BRAND_NAME",
    label: "Brand Name",
    hint: "Printed as the letterhead title on every invoice and agreement.",
  },
  {
    key: "BRAND_ADDRESS",
    label: "Address",
    kind: "textarea",
    hint: "Used when the branch has no address of its own.",
  },
  {
    key: "BRAND_PHONE",
    label: "Phone Number",
    hint: "Used when the branch has no phone number of its own.",
  },
  {
    key: "BRAND_EMAIL",
    label: "Email",
    kind: "email",
    hint: "Contact address shown on documents.",
  },
  {
    key: "BRAND_WEBSITE",
    label: "Website",
    kind: "url",
    hint: "Shown beneath the contact details.",
  },
  {
    key: "BRAND_LOGO_URL",
    label: "Logo URL",
    kind: "url",
    hint: "Absolute URL. A logo that cannot be fetched falls back to the brand name in text.",
  },
];

/**
 * Letterhead scope: the company-wide default, or one branch.
 *
 * Mirrors `BrandSettingKeys` in the API. A branch's value lives in its own row,
 * the company-wide key followed by the branch token — `BRAND_ADDRESS_PIK2`,
 * `BRAND_ADDRESS_KEDOYA` — the same per-branch convention the drop-in prices
 * use. Saving one branch therefore never touches another, and a value a branch
 * leaves blank falls back to the company-wide one when a document is rendered.
 */
export type BrandScope = { branchId: string; branchName: string } | null;

/** "PIK 2", "pik2" and "PIK-2" all become "PIK2". Same rule as the API. */
export function brandBranchToken(branchName: string): string {
  return branchName.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The setting key a letterhead field is stored under for a scope. */
export function brandKeyFor(key: string, scope: BrandScope): string {
  if (!scope) return key;
  const token = brandBranchToken(scope.branchName);
  return token ? `${key}_${token}` : key;
}

/**
 * The drop-in discount percentage the backend applies to a single visit or day
 * pass bought by an existing member.
 */
export const DROP_IN_DISCOUNT_KEY = "DROP_IN_MEMBER_DISCOUNT_PERCENT";

/**
 * Letterhead values that are configuration-only.
 *
 * `LegalName` and `FromEmail` are read straight from the API's `Brand` section
 * with no System Settings override, so they are shown here for reference and
 * cannot be edited from the portal — offering an input that silently saved
 * nothing would be worse than saying so.
 */
export const READ_ONLY_BRAND_FIELDS = [
  {
    label: "Legal Name",
    configKey: "Brand:LegalName",
  },
  {
    label: "From Email",
    configKey: "Brand:FromEmail",
  },
] as const;

/** Turns the settings list into a key/value lookup. */
export function toSettingMap(
  settings: SystemSetting[]
): Record<string, SystemSetting> {
  return Object.fromEntries(settings.map((s) => [s.key, s]));
}

/**
 * Normalises a website or logo address typed into Brand Settings.
 *
 * People type `www.sweatboxfnp.com` or `sweatboxfnp.com`, not a full URL, and
 * the browser's `type="url"` check rejected both — which also blocked the whole
 * form from submitting. A value without a scheme is given `https://`, since the
 * documents link to it and the PDF renderer fetches the logo from it.
 *
 * @returns `""` for a blank value, the normalised absolute URL, or `null` when
 *   the value is not a usable http(s) address.
 */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  if (/\s/.test(value)) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https?:\/\//i.test(value)) return null;
  const candidate = hasScheme ? value : `https://${value.replace(/^\/+/, "")}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  // A real host: dot-separated labels ending in an alphabetic TLD, or
  // localhost. Rejects things like `https://foo` or `https://.com`.
  const host = url.hostname;
  const isDomain =
    /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i.test(host) &&
    host.split(".").every((label) => !label.startsWith("-") && !label.endsWith("-"));
  if (!isDomain && host !== "localhost") return null;

  // Keep what the user typed after the scheme; `url.href` would add a trailing
  // slash to a bare domain and lowercase the path's host only.
  return hasScheme ? value : candidate;
}

/** A pragmatic address check: something@domain.tld, no spaces. */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}
