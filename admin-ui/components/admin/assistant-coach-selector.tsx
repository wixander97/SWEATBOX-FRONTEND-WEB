"use client";

import { useMemo } from "react";
import { FIELD_CLASS, LABEL_CLASS } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";
import {
  RATE_TYPES,
  tiersFor,
  type CoachRateTier,
} from "@/lib/coach-rates";
import type { AssistantCoachAssignment } from "@/lib/class-schedules";

/**
 * The assistant coaches on a class, and what each is paid.
 *
 * A class may have none, one, or several. A coach already on the class — as
 * primary or as another assistant — is not offered again: the backend rejects a
 * duplicate rather than quietly de-duplicating it, so letting one be picked
 * would only produce a failed save at the desk.
 */

type CoachOption = { id: string; name: string };

export function AssistantCoachSelector({
  value,
  onChange,
  coaches,
  tiers,
  branchId,
  primaryCoachId,
  disabled,
}: {
  value: AssistantCoachAssignment[];
  onChange: (next: AssistantCoachAssignment[]) => void;
  coaches: CoachOption[];
  tiers: CoachRateTier[];
  branchId: string;
  primaryCoachId: string;
  disabled?: boolean;
}) {
  const assistantTiers = useMemo(
    () => tiersFor(tiers, RATE_TYPES.assistant, branchId),
    [tiers, branchId]
  );

  /** Coaches still free to be added, given who is already on the class. */
  const available = useMemo(() => {
    const taken = new Set(value.map((a) => a.coachId));
    if (primaryCoachId) taken.add(primaryCoachId);
    return coaches.filter((coach) => !taken.has(coach.id));
  }, [coaches, value, primaryCoachId]);

  function add() {
    const next = available[0];
    if (!next) return;
    onChange([...value, { coachId: next.id, coachRateTierId: null }]);
  }

  function update(index: number, patch: Partial<AssistantCoachAssignment>) {
    onChange(
      value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  /** The options for one row: everything free, plus that row's own pick. */
  function optionsFor(index: number) {
    const own = value[index]?.coachId;
    const ownCoach = coaches.find((c) => c.id === own);
    return ownCoach ? [ownCoach, ...available] : available;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`${LABEL_CLASS} !mb-0`}>Assistant Coaches</span>
        <button
          type="button"
          onClick={add}
          disabled={disabled || available.length === 0}
          className="text-xs bg-white/5 hover:bg-white/10 text-white border border-border px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i className="fas fa-plus mr-1.5" aria-hidden />
          Add assistant
        </button>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-gray-500 border border-dashed border-border rounded-lg px-4 py-3">
          No assistant coaches. A class can run with the primary coach alone.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((assignment, index) => (
            <li
              key={`${assignment.coachId}-${index}`}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start bg-sidebar border border-border rounded-lg p-3"
            >
              <div>
                <label
                  className="sr-only"
                  htmlFor={`assistant-coach-${index}`}
                >
                  Assistant coach {index + 1}
                </label>
                <select
                  id={`assistant-coach-${index}`}
                  className={`${FIELD_CLASS} !py-2 text-sm`}
                  value={assignment.coachId}
                  onChange={(e) => update(index, { coachId: e.target.value })}
                  disabled={disabled}
                >
                  {optionsFor(index).map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="sr-only" htmlFor={`assistant-tier-${index}`}>
                  Rate tier for assistant {index + 1}
                </label>
                <select
                  id={`assistant-tier-${index}`}
                  className={`${FIELD_CLASS} !py-2 text-sm`}
                  value={assignment.coachRateTierId ?? ""}
                  onChange={(e) =>
                    update(index, {
                      coachRateTierId: e.target.value || null,
                    })
                  }
                  disabled={disabled}
                >
                  <option value="">Branch default rate</option>
                  {assistantTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} — {formatCurrency(tier.rate)}
                      {tier.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => remove(index)}
                disabled={disabled}
                className="text-red-500 hover:text-red-400 px-3 py-2 disabled:opacity-40 justify-self-end"
                aria-label={`Remove assistant coach ${index + 1}`}
                title="Remove"
              >
                <i className="fas fa-trash" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {assistantTiers.length === 0 ? (
        <p className="text-xs text-gray-500">
          No assistant rate tiers are configured for this branch. Assistants will
          be paid at the branch default, or at their own payroll rate.
        </p>
      ) : null}
    </div>
  );
}
