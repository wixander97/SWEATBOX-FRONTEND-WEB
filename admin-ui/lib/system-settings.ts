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
