---
description: Create a spec-driven plan with SPEC, TASKS, and BDD
argument-hint: "<feature/request>"
---
You are in PLAN mode.

Rules:
- Do not implement code.
- Do not modify files unless the user has approved the final plan and asks to save it.
- Inspect existing code only as needed for compatibility.
- Keep the plan compact, concrete, and unambiguous.
- Avoid overengineering, unrelated refactors, and scope creep.

Clarification questions:
- When clarification is needed, prefer multiple-choice style questions.
- Include 2-5 suggested answer options when practical.
- Mark one option as Recommended/default if there is a clear best path.
- Include an "Other / custom answer" option so the user can choose outside the suggestions.
- Do not force multiple-choice format when the topic genuinely requires free-form exploration.

Question Quality Gate:
- All clarification and open questions must pass this gate.
- Ask only when the answer cannot be safely derived from the request/spec, existing code/patterns/docs, best practices, or security/performance/UX/backward-compatibility/data-integrity constraints.
- If a safe default is clear, state the assumption/recommendation and proceed within scope instead of asking. A safe default matches the objective, follows existing patterns or best practice, and does not broaden scope or introduce material risk.
- In PLAN mode, ask only about unresolved product, scope, or behavior decisions.
- Each question must include: Blocking/Non-blocking, why unresolved, considered context, recommended/default if defensible, impact if unanswered, and options including Other/custom when practical.
- If no question passes this gate, write `Open questions: None.` and list material `Assumptions applied:`.

Produce:
1. Goal
2. Scope
3. Non-scope
4. Existing context
5. Proposed approach
6. Files likely affected
7. SPEC with stable requirement/acceptance IDs such as FR-001 and AC-001
8. TASKS grouped as Implementation, Verification, Tests, and Deferred / Out of Scope
9. BDD scenarios with stable IDs such as BDD-001 using structured Given/When/Then
10. Validation commands
11. Risks / edge cases
12. Open questions, if any

BDD policy:
- BDD.md is the single canonical behavior artifact.
- Do not create .feature files in this workflow unless the user explicitly asks.
- Each BDD scenario must map to acceptance criteria and planned test tasks.

If the plan is approved and saved, use separate files under a numbered feature folder:
- docs/specs/<group>/<NNN-feature-slug>/SPEC.md
- docs/specs/<group>/<NNN-feature-slug>/TASKS.md
- docs/specs/<group>/<NNN-feature-slug>/BDD.md

Numbered spec folder rule:
- Numbering is scoped per group, not global.
- Before saving a new spec, inspect `docs/specs/<group>/` and find the highest existing folder prefix matching `NNN-`.
- Use the next number in 3-digit format, e.g. after `001-*` and `002-*`, save the next spec as `003-<feature-slug>`.
- If no numbered folder exists in the group, start at `001-<feature-slug>`.
- Do not save new specs in unnumbered `docs/specs/<group>/<feature-slug>/` folders.

Allowed groups:
- web: apps/web specific work
- mobile: apps/mobile specific work
- supabase: database/schema/RLS/migration work
- global: cross-app or monorepo-level work

If the correct group is unclear, ask before saving.

Always end with a compact `Final status` block:
- Verdict: Draft ready / Needs clarification / Blocked
- Action required: None, or Yes with one short required action
- Recommended next action: exactly one clear next step

Default next-action guidance:
- If the plan is draft-ready with no blocking questions, recommend running `/plan-review` in a new clean session before approval/implementation.
- If clarification is needed, recommend answering the open questions first, then running `/plan-review` in a new clean session.
- Do not end with diagnostic-only sections; make the final next step unambiguous.

User request:
$@
