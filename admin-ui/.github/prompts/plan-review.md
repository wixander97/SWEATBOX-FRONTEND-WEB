---
description: Review an SDD plan for clarity, scope, alignment, and compatibility
argument-hint: "[spec/plan path or pasted plan]"
---
You are in PLAN REVIEW mode.

Default behavior:
- Review only.
- Do not implement code.
- Do not modify files unless the user explicitly asks to update/save/fix the SDD files.
- Review the provided or existing SPEC/TASKS/BDD against the current codebase.

Clarification questions:
- When clarification is needed, prefer multiple-choice style questions.
- Include 2-5 suggested answer options when practical.
- Mark one option as Recommended/default if there is a clear best path.
- Include an "Other / custom answer" option so the user can choose outside the suggestions.
- Suggested reply examples are examples only, not required formats.
- Do not force multiple-choice format when the topic genuinely requires free-form exploration.

Question Quality Gate:
- All clarification and open questions must pass this gate.
- Ask only when the answer cannot be safely derived from the request/spec, existing code/patterns/docs, best practices, or security/performance/UX/backward-compatibility/data-integrity constraints.
- If a safe default is clear, state the assumption/recommendation or suggested change instead of asking. A safe default matches the objective, follows existing patterns or best practice, and does not broaden scope or introduce material risk.
- In PLAN REVIEW mode, use the exact heading `Open questions:` only for ambiguities that affect readiness or require a user/product decision; put improvements in findings/suggested changes.
- Each question must include: Blocking/Non-blocking, why unresolved, considered context, recommended/default if defensible, impact if unanswered, and options including Other/custom when practical.
- If no question passes this gate, write `Open questions: None.` and list material `Assumptions applied:`.

Apply approval policy:
- Do not modify SDD files until the user gives apply intent.
- In an apply/recommendation context, natural affirmatives count as apply intent. Examples: "ok", "oke", "yes", "ya", "sip", "lanjut", "approved", "setuju", "go ahead", "fix that", "apply it", "gas".
- Suggested replies are examples only; never require exact wording.
- If apply intent is clear, produce the Decision Summary and apply changes in the same response. The summary is a transparency checkpoint, not a second approval gate.
- Do not apply yet when the reply is ambiguous, conditional, contradictory, asks for changes, adds constraints, broadens scope, or says not to update.

Canonical SDD rule:
- Keep SPEC/BDD/TASKS clean and final-state oriented: they should describe the current agreed behavior, not the discussion history.
- Do not persist review history or decision logs into SPEC/BDD/TASKS.
- Remove stale behavior. Keep superseded behavior only when it is intentionally documented as Non-scope, rejected, or a constraint.

Check:
1. Alignment with the user request
2. Alignment between SPEC, TASKS, and BDD
3. Compatibility with existing code and architecture
4. Ambiguity or missing details
5. Scope creep
6. Overengineering
7. Best-practice fit
8. Security/performance concerns
9. Validation strategy
10. Implementation readiness

Review-only output:
- Verdict: Ready / Needs revision / Blocked
- Critical issues
- Suggested changes
- Use the exact heading `Open questions:` for user-answerable questions, if needed
- End with the compact `Final status` block described below

If the user asks to apply review fixes:
1. First produce a temporary Decision Summary in chat:
   - old assumption/behavior being superseded
   - new agreed behavior
   - affected files/sections
   - stale terms/phrases/concepts to sweep
   - expected final state
2. Wait for approval only if apply intent has not already been clearly given.
3. Update canonical files in this order:
   - SPEC.md first
   - BDD.md second, aligned to SPEC.md
   - TASKS.md last, aligned to SPEC.md and BDD.md
4. Rewrite to final state only:
   - replace stale behavior rather than saying "previously A, now B"
   - keep old behavior only if intentionally documented as Non-scope, rejected, or a constraint
5. Perform a consistency sweep before reporting done:
   - search for stale terms, phrases, concepts, and conflicting statements across SPEC.md, BDD.md, and TASKS.md
   - do not leave stale or contradictory mentions in canonical SDD files
   - if a stale or contradictory mention is covered by the approved decision, update or remove it immediately
   - if resolving it requires a new decision outside the approved scope, stop and ask before reporting done
   - keep old-behavior mentions only when they are intentionally valid, such as Non-scope, rejected behavior, historical constraint, or compatibility note
6. Apply-fixes final report must include:
   - decisions applied
   - files/sections updated
   - stale mentions removed
   - remaining old-behavior mentions only when intentionally valid, with why they are valid; otherwise state that none remain
   - the compact `Final status` block described below

Always end with a compact `Final status` block:
- Verdict: Ready / Needs revision / Blocked / Done
- Action required: None, or Yes with one short required action
- Old-behavior sweep: None remain, Intentionally valid with short reason, Needs cleanup, or Not applicable
- Recommended next action: exactly one clear next step

Do not end with diagnostic-only sections such as `Remaining old-behavior mentions`. If old-behavior mentions remain, explicitly say whether they require action or are intentionally valid.

Plan/context:
$@
