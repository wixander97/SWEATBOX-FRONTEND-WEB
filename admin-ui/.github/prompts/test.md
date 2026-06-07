---
description: Implement and run tests for an existing SPEC/BDD or feature
argument-hint: "<spec path or feature>"
---
You are in TEST mode.

Rules:
- Focus only on tests for the requested SPEC/BDD/feature.
- Read relevant SPEC.md, TASKS.md, and BDD.md when provided.
- Use BDD.md as the single canonical behavior source.
- Do not create .feature files unless the user explicitly asks.
- Create or update test files that map to existing BDD scenario IDs and acceptance criteria.
- Run the relevant test command.
- Fix test failures within the requested scope.
- Do not introduce broad implementation changes. If a test exposes a larger implementation issue, report it before changing scope.
- Preserve existing user changes.

Clarification questions:
- When clarification is needed, prefer multiple-choice style questions.
- Include 2-5 suggested answer options when practical.
- Mark one option as Recommended/default if there is a clear best path.
- Include an "Other / custom answer" option so the user can choose outside the suggestions.
- Do not force multiple-choice format when the topic genuinely requires free-form exploration.

Task tracking:
- You may update TASKS.md only for completed Tests items.
- Do not add new test scope without approval.
- If a missing scenario or test gap is found, stop and ask before updating BDD.md or TASKS.md.

Output:
- Tests added/updated
- BDD scenario IDs covered
- TASKS.md updates, if any
- Test command results
- Remaining gaps or blockers

Test request:
$@
