import {
  dropInKindOf,
  dropInVisitsOf,
  isDropInPlan,
  listMembershipPlans,
  type DropInKind,
  type MembershipPlan,
} from "./membership-plans";
import {
  dropInOptionsFromSettings,
  listSystemSettings,
  type DropInSettingOption,
} from "./system-settings";

/**
 * The drop-in menu the front desk sells from.
 *
 * Two sources, in the order the gym expects them:
 *
 *  1. **System Settings** — where drop-in pricing is configured and what the
 *     member app reads, so the counter must not disagree with it; and
 *  2. **Membership plans marked "Drop In"** — the catalogue rows that already
 *     existed, used when settings carry no usable drop-in configuration.
 *
 * A plan is needed either way: `POST /api/v1/payments` takes a
 * `membershipPlanId`, so a settings-defined tier is charged against the drop-in
 * plan it corresponds to. A tier with no plan behind it cannot be rung up
 * without a backend change, so it is left out and reported through `warning`
 * rather than shown as a button that would fail.
 */
export type DropInOption = {
  /** Stable key for lists and selection. */
  id: string;
  label: string;
  kind: DropInKind;
  visits: number;
  price: number;
  validityDays?: number;
  /** Plan the payment is created against. */
  planId: string;
  /** Plan's own branch, which wins over the till's when it has one. */
  planBranchId?: string;
  source: "settings" | "plan";
};

export type DropInOptionsResult = {
  options: DropInOption[];
  source: "settings" | "plan" | "none";
  /** Why the list is shorter than the configuration suggests, if it is. */
  warning: string | null;
};

function optionFromPlan(plan: MembershipPlan): DropInOption {
  const visits = dropInVisitsOf(plan);
  const kind = dropInKindOf(plan) ?? (visits > 1 ? "pass" : "single");
  return {
    id: plan.id,
    label: plan.planName,
    kind,
    visits,
    price: plan.price ?? 0,
    validityDays: plan.validityDays,
    planId: plan.id,
    planBranchId: plan.branchId,
    source: "plan",
  };
}

/**
 * The plan a settings tier is charged against.
 *
 * Same shape first (a 5-visit pass against the 5-visit plan), then the same
 * kind, and only then any drop-in plan at all — a single visit and a pass are
 * charged under different payment categories, so kind matters more than price.
 */
function matchPlan(option: DropInSettingOption, plans: MembershipPlan[]): MembershipPlan | null {
  const sameKind = plans.filter(
    (plan) => (dropInKindOf(plan) ?? "single") === option.kind
  );
  return (
    sameKind.find((plan) => dropInVisitsOf(plan) === option.visits) ??
    sameKind[0] ??
    (option.kind === "single" ? (plans.find((p) => dropInVisitsOf(p) === 1) ?? null) : null)
  );
}

/**
 * Load the drop-in options sellable at one branch.
 *
 * Never throws: a settings outage falls back to the plans, and a plan outage
 * leaves an empty menu with a message. The till has a customer standing at it.
 */
export async function loadDropInOptions(branchId?: string): Promise<DropInOptionsResult> {
  const [settingsResult, plansResult] = await Promise.allSettled([
    listSystemSettings({ redirectOn401: false }),
    listMembershipPlans({ redirectOn401: false }),
  ]);

  const allPlans = plansResult.status === "fulfilled" ? plansResult.value : [];
  // A record with no branch is shown rather than hidden — plans predating the
  // branch column would otherwise become unsellable, exactly as in the catalogue.
  const dropInPlans = allPlans.filter(
    (plan) =>
      isDropInPlan(plan) &&
      plan.isActive !== false &&
      (!plan.branchId || !branchId || plan.branchId === branchId)
  );

  const settings =
    settingsResult.status === "fulfilled"
      ? dropInOptionsFromSettings(settingsResult.value)
      : null;

  if (settings?.disabled) {
    return {
      options: [],
      source: "none",
      warning: "Drop-in dimatikan di System Settings.",
    };
  }

  if (settings && settings.options.length > 0) {
    const chargeable: DropInOption[] = [];
    const unmatched: string[] = [];
    for (const option of settings.options) {
      const plan = matchPlan(option, dropInPlans);
      if (!plan) {
        unmatched.push(option.label);
        continue;
      }
      chargeable.push({
        id: option.key,
        label: option.label,
        kind: option.kind,
        visits: option.visits,
        price: option.price,
        validityDays: option.validityDays ?? plan.validityDays,
        planId: plan.id,
        planBranchId: plan.branchId,
        source: "settings",
      });
    }

    if (chargeable.length > 0) {
      const notes = [...settings.warnings];
      if (unmatched.length > 0) {
        notes.push(
          `${unmatched.join(", ")} belum punya membership plan berkategori "Drop In", jadi belum bisa ditagih dari POS.`
        );
      }
      return {
        options: chargeable,
        source: "settings",
        warning: notes.length > 0 ? notes.join(" ") : null,
      };
    }
  }

  if (dropInPlans.length > 0) {
    const configured = (settings?.options.length ?? 0) > 0;
    return {
      options: dropInPlans
        .map(optionFromPlan)
        .filter((option) => option.price > 0)
        .sort((a, b) => a.visits - b.visits || a.price - b.price),
      source: "plan",
      warning: configured
        ? "Opsi drop-in di System Settings belum cocok dengan plan mana pun — memakai membership plan berkategori \"Drop In\"."
        : null,
    };
  }

  const problems: string[] = [];
  if (settingsResult.status === "rejected") problems.push("System Settings gagal dimuat.");
  if (plansResult.status === "rejected") problems.push("Membership plan gagal dimuat.");
  if (settings?.warnings.length) problems.push(...settings.warnings);

  return {
    options: [],
    source: "none",
    warning:
      problems.length > 0
        ? problems.join(" ")
        : "Belum ada konfigurasi drop-in: isi harga drop-in di System Settings atau buat membership plan dengan kategori \"Drop In\".",
  };
}

/** Card/line subtitle: "5x kunjungan · berlaku 30 hari". */
export function dropInOptionSubtitle(option: DropInOption): string {
  const visits = option.visits > 1 ? `${option.visits}x kunjungan` : "1x kunjungan";
  return option.validityDays ? `${visits} · berlaku ${option.validityDays} hari` : visits;
}
