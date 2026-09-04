import type { DropInKind } from "./membership-plans";
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
  let settings;
  try {
    settings = await listSystemSettings({ redirectOn401: false });
  } catch {
    return {
      options: [],
      warning: "System Settings gagal dimuat, jadi harga drop-in belum bisa ditampilkan.",
    };
  }

  const parsed = dropInOptionsFromSettings(settings);
  if (parsed.disabled) {
    return { options: [], warning: "Drop-in dimatikan di System Settings." };
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
        ? `Drop-in belum dikonfigurasi untuk branch ${branchName || "ini"} — yang ada di System Settings baru ${configured.join(", ")}.`
        : `Belum ada konfigurasi drop-in di System Settings (mis. DROP_IN_SINGLE_${wanted || "<BRANCH>"}).`
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

/** Card/line subtitle: "5x kunjungan · berlaku 30 hari". */
export function dropInOptionSubtitle(option: DropInOption): string {
  const visits = option.visits > 1 ? `${option.visits}x kunjungan` : "1x kunjungan";
  return option.validityDays ? `${visits} · berlaku ${option.validityDays} hari` : visits;
}
