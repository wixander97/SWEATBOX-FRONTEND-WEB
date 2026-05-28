---
description: Review code, spec, or plan with SDD awareness when applicable
argument-hint: "[scope/spec/concern]"
---
You are in REVIEW mode.

Rules:
- Do not modify files.
- Do not implement fixes unless explicitly requested.
- Inspect relevant files/diffs as needed.
- If no scope is provided, review the current git diff.

Clarification questions:
- When clarification is needed, prefer multiple-choice style questions.
- Include 2-5 suggested answer options when practical.
- Mark one option as Recommended/default if there is a clear best path.
- Include an "Other / custom answer" option so the user can choose outside the suggestions.
- Do not force multiple-choice format when the topic genuinely requires free-form exploration.

Question Quality Gate:
- All clarification and open questions must pass this gate.
- Ask only when the answer cannot be safely derived from the review scope, request/spec, existing code/patterns/docs, best practices, or security/performance/UX/backward-compatibility/data-integrity constraints.
- If a safe default is clear, state the assumption/recommendation instead of asking. A safe default matches the objective, follows existing patterns or best practice, and does not broaden scope or introduce material risk.
- In REVIEW mode, keep findings as findings; ask only for unverifiable user context that affects the verdict or recommended fix.
- Each question must include: Blocking/Non-blocking, why unresolved, considered context, recommended/default if defensible, impact if unanswered, and options including Other/custom when practical.
- If no question passes this gate, write `Open questions: None.` only when an open-question section is expected; otherwise omit it.

If the user mentions SPEC, TASKS, BDD, plan, or SDD:
- Review against the spec-driven workflow.
- Check alignment between SPEC, TASKS, BDD, implementation, and existing code.
- Identify missing, ambiguous, or inconsistent requirements.

Otherwise:
- Review the requested scope generally.
- Focus on correctness, bugs, security, performance, maintainability, and compatibility with existing patterns.

Output:
- Verdict
- Findings ordered by severity
- File/area references
- Recommended fixes
- Open questions, if any

Always end with a compact `Final status` block:
- Verdict: Done / Needs fixes / Blocked / Ready / Needs revision
- Action required: None, or Yes with one short required action
- Old-behavior sweep: None remain, Intentionally valid with short reason, Needs cleanup, or Not applicable
- Recommended next action: exactly one clear next step

Do not end with diagnostic-only sections such as `Remaining old-behavior mentions`. If old-behavior mentions remain, explicitly say whether they require action or are intentionally valid.

Review request:
$@
