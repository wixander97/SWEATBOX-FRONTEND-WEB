import type { DropInKind } from "./membership-plans";
import { DROP_IN_CATEGORY, dropInProductLabel, getDropInCatalogue } from "./drop-in";
import {
  dropInOptionsFromSettings,
  listSystemSettings,
  normalizeToken,
} from "./system-settings";

/**
 * The drop-in menu the front desk sells from.
 *
 * System Settings is the only source, because it is the only source the
 * *backend* uses: `POST /api/v1/payments` with `paymentCategory`
 * `DropInSingle` (3) or `DropInPass` (4) takes no membership plan at all — it
 * takes a branch, and prices the payment from `DROP_IN_SINGLE_<BRANCH>` /
 * `DROP_IN_PASS_<BRANCH>` itself (verified against the live API: Kedoya single
 * → Rp 100.000, Kedoya pass → Rp 45.000, invoice prefix `DIP-`).
 *
 * Reading the price from anywhere else — a membership plan marked "Drop In",
 * say — would show the customer a number the backend then ignores, so this
 * deliberately has no other fallback. When a branch has no drop-in configured,
 * the till says so instead of quoting a price it cannot charge.
 */
export type DropInOption = {
  /** Settings key the price came from. */
  id: string;
  label: string;
  kind: DropInKind;
  /** Classes covered; 0 = unlimited (One Day Pass). */
  visits: number;
  price: number;
  validityDays?: number;
  /** Branch part of the settings key, "" when it applies to every branch. */
  branchToken: string;
};

export type DropInOptionsResult = {
  options: DropInOption[];
  /** Why the menu is empty or shorter than the settings suggest. */
  warning: string | null;
};

/**
 * Drop-in tiers sellable at one branch.
 *
 * `branchName` is matched against the branch part of the setting key
 * ("Kedoya" → `DROP_IN_SINGLE_KEDOYA`); a key that names no branch applies
 * everywhere. Never throws — the till has a customer standing at it.
 */
export async function loadDropInOptions(branchName?: string): Promise<DropInOptionsResult> {
  const fromCatalogue = await optionsFromCatalogue(branchName);
  if (fromCatalogue) return fromCatalogue;

  let settings;
  try {
    settings = await listSystemSettings({ redirectOn401: false });
  } catch {
    return {
      options: [],
      warning: "System Settings failed to load, so drop-in prices cannot be shown.",
    };
  }

  const parsed = dropInOptionsFromSettings(settings);
  if (parsed.disabled) {
    return { options: [], warning: "Drop-in is disabled in System Settings." };
  }

  const wanted = branchName ? normalizeToken(branchName) : "";
  const forBranch = parsed.options.filter(
    (option) => !option.branchToken || !wanted || option.branchToken === wanted
  );

  const notes = [...parsed.warnings];
  if (forBranch.length === 0) {
    const configured = Array.from(
      new Set(parsed.options.map((o) => o.branchToken).filter(Boolean))
    );
    notes.push(
      configured.length > 0
        ? `Drop-in is not configured for branch ${branchName || "this"} — System Settings currently only has ${configured.join(", ")}.`
        : `No drop-in configuration in System Settings yet (e.g. DROP_IN_SINGLE_${wanted || "<BRANCH>"}).`
    );
  }

  return {
    options: forBranch.map((option) => ({
      id: option.key,
      label: option.label,
      kind: option.kind,
      visits: option.visits,
      price: option.price,
      validityDays: option.validityDays,
      branchToken: option.branchToken,
    })),
    warning: notes.length > 0 ? notes.join(" ") : null,
  };
}

/**
 * The backend's own catalogue (`GET /api/v1/drop-in/catalogue`), which reads
 * the same settings rows but also knows the defaults a branch sells before
 * anyone configured it. Null when the endpoint is missing (older backend) or
 * does not know this branch, so the caller falls back to System Settings.
 */
async function optionsFromCatalogue(branchName?: string): Promise<DropInOptionsResult | null> {
  const wanted = branchName ? normalizeToken(branchName) : "";
  if (!wanted) return null;

  let products;
  try {
    products = await getDropInCatalogue({ redirectOn401: false });
  } catch {
    return null;
  }

  const atBranch = products.filter((p) => normalizeToken(p.branchName) === wanted);
  if (atBranch.length === 0) return null;

  const enabled = atBranch.filter((p) => p.isEnabled);
  const options: DropInOption[] = enabled
    .map((p) => ({
      id: `${p.branchId}:${p.paymentCategory}`,
      label: dropInProductLabel(p),
      kind: (p.paymentCategory === DROP_IN_CATEGORY.singleVisit ? "single" : "pass") as DropInKind,
      visits: p.isUnlimited ? 0 : (p.visits ?? 1),
      price: p.price,
      validityDays: p.validityDays,
      branchToken: wanted,
    }))
    .sort((a, b) => (a.kind === "single" ? 0 : 1) - (b.kind === "single" ? 0 : 1) || a.price - b.price);

  return {
    options,
    warning:
      options.length === 0
        ? `Drop-in is switched off for branch ${branchName}. Turn it on under Drop In → Products.`
        : null,
  };
}

/** Card/line subtitle: "Unlimited classes · valid for 1 day". */
export function dropInOptionSubtitle(option: DropInOption): string {
  const visits =
    option.visits <= 0
      ? "Unlimited classes"
      : option.visits > 1
        ? `${option.visits}x visits`
        : "1x visit";
  return option.validityDays ? `${visits} · valid for ${option.validityDays} days` : visits;
}
