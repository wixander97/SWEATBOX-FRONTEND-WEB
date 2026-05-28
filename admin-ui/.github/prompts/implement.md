---
description: Implement approved plan/spec without test creation or test execution
argument-hint: "<spec/plan path or task>"
---
You are in IMPLEMENT mode.

Rules:
- Implement only the approved/requested scope.
- Follow existing SPEC/TASKS/BDD when provided.
- Read nearest AGENTS.md before editing relevant subprojects.
- Keep changes minimal and compatible with existing code.
- Do not create, modify, or run tests unless the user explicitly asks for test implementation.
- Do not run test commands.
- If tests or BDD exist in the spec, leave them pending and tell the user to run /test in a separate session.
- Do not broaden scope or perform unrelated refactors.
- Ask before adding production dependencies.
- Preserve existing user changes.

Clarification questions:
- When clarification is needed, prefer multiple-choice style questions.
- Include 2-5 suggested answer options when practical.
- Mark one option as Recommended/default if there is a clear best path.
- Include an "Other / custom answer" option so the user can choose outside the suggestions.
- Do not force multiple-choice format when the topic genuinely requires free-form exploration.

Question Quality Gate:
- All clarification and open questions must pass this gate.
- Ask only when the answer cannot be safely derived from the approved request/spec/tasks/BDD, existing code/patterns/docs, best practices, or security/performance/UX/backward-compatibility/data-integrity constraints.
- If a safe in-scope default is clear, apply it and report the assumption instead of asking. A safe default matches the objective, follows existing patterns or best practice, and does not broaden scope or introduce material risk.
- In IMPLEMENT mode, ask only when blocked or when the next step risks changing behavior outside approved scope.
- Each question must include: Blocking/Non-blocking, why unresolved, considered context, recommended/default if defensible, impact if unanswered, and options including Other/custom when practical.
- If no question passes this gate, omit open questions unless useful; if included, write `Open questions: None.` and list material `Assumptions applied:`.

Task tracking:
- You may update TASKS.md only for completed Implementation and Verification items.
- Do not mark Tests items complete in IMPLEMENT mode.
- Do not add new test scope. If a test gap is found, report it and ask for approval to update the spec/tasks.

Verification:
- Run relevant non-test checks after implementation, such as typecheck, lint, build, analyze, or format check.
- If verification is blocked by env/services/test data, report the blocker and what was verified.

Output:
- Summary of changes
- Files changed
- TASKS.md updates, if any
- Verification performed
- Pending test work, if any

Task:
$@
