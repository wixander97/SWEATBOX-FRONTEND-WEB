---
name: spec-driven-dev
description: Spec-driven development workflow for this POS monorepo. Use for /plan, /plan-review, /implement, /test, /review, feature work, behavior changes, schema/RLS changes, cross-app changes, and SDD specs.
---

# Spec-Driven Development Workflow

Project-wide SDD policy for the POS monorepo. This skill connects the prompt templates with a single, consistent SPEC/TASKS/BDD workflow.

## Canonical SDD Files

Use this structure for SDD work:

```txt
docs/specs/<group>/<feature-slug>/
  SPEC.md
  TASKS.md
  BDD.md
```

Allowed groups:

- `web`: `apps/web` specific work
- `mobile`: `apps/mobile` specific work
- `supabase`: database/schema/RLS/migration work
- `global`: cross-app or monorepo-level work

If the group is unclear, ask before saving specs.

## When SDD Is Required

Require SDD for:

- New features
- Behavior changes
- Schema, migration, or RLS changes
- Cross-app/shared changes
- Complex or risky multi-file changes

SDD is usually not required for:

- Typos or small docs-only edits
- Prompt template edits
- Simple config changes
- Small refactors with no behavior change

When unsure, ask whether the user wants full SDD.

## Canonical BDD Policy

- `BDD.md` is the single canonical behavior artifact.
- Do not create `.feature` files by default.
- Do not require `*.feature` files for planning or implementation.
- Only create `.feature` files if the user explicitly asks.
- BDD scenarios must use stable IDs such as `BDD-001`.
- BDD scenarios should map to acceptance criteria and test tasks.

Recommended `BDD.md` scenario format:

```md
### BDD-001: Successful checkout
Priority: P0
Type: happy-path
Covers:
- SPEC: AC-001
- TASKS: TEST-001

Given:
- Cashier has items in the cart

When:
- Cashier completes payment

Then:
- Sale is recorded
- Receipt is available

Test intent:
- Verify the successful checkout behavior through the most appropriate test level.
```

## Recommended SPEC.md Structure

```md
# SPEC: <Feature>

## Status
- Group: web | mobile | supabase | global
- Feature: <feature-slug>
- Status: draft | approved | implementing | testing | done
- Priority: P0 | P1 | P2

## Goal

## Scope

## Non-scope

## Existing Context

## Requirements

### Functional Requirements
- FR-001: ...

### Non-functional Requirements
- NFR-001: ...

## Acceptance Criteria
- AC-001: ...

## Dependencies

## Risks / Edge Cases

## Validation Strategy
```

## Recommended TASKS.md Structure

```md
# TASKS: <Feature>

## Implementation
- [ ] IMPL-001: ...

## Verification
- [ ] VERIFY-001: Run typecheck
- [ ] VERIFY-002: Run lint
- [ ] VERIFY-003: Run build/analyze

## Tests
- [ ] TEST-001: Cover BDD-001 ...

## Deferred / Out of Scope
- [ ] ...
```

## Open Question Quality Gate

All clarification and open questions must pass this gate.

Ask only when the answer cannot be safely derived from:

1. the user request, objective, existing SPEC/TASKS/BDD, or acceptance criteria;
2. existing code, architecture, project docs, or established local patterns;
3. relevant best practices and tradeoffs;
4. security, performance, UX, backward compatibility, data integrity, or operational constraints.

Do not ask low-effort or speculative questions just because a detail is not written explicitly. If a safe default is clear, state the assumption or recommendation and proceed within scope instead of asking the user. A safe default means it matches the objective, follows existing patterns or best practice, and does not broaden scope or introduce material risk.

When questions are needed, each question must include:

- `Blocking` or `Non-blocking` label;
- why the answer is unresolved after considering objective/spec, existing code/patterns, and best practice/tradeoffs;
- the considered context from objective/spec, existing code/patterns, and best practice/tradeoffs;
- a recommended/default option when one is defensible;
- the impact if unanswered;
- 2-5 options when practical, including `Other / custom answer`.

Use this shape:

```md
Open questions:
1. [Blocking / Non-blocking] <question>
   - Why this is unresolved: <why spec/code/best practice do not settle it>
   - Considered context:
     - Objective/spec: <summary>
     - Existing code/pattern: <summary>
     - Best practice/tradeoff: <summary>
   - Recommended/default: <recommended option, if any>
   - Options:
     A. <option> (Recommended/default)
     B. <option>
     C. Other / custom answer
   - Impact if unanswered: <blocked work or risk of assumption>
```

If no user-answerable question passes this gate, write:

```md
Open questions: None.
Assumptions applied:
- <safe assumption and why it follows from spec/code/best practice>
```

Mode-specific guidance:

- `/plan`: Ask only about unresolved product, scope, or behavior decisions. For technical defaults that are clear from existing patterns or best practice, recommend a default instead of asking.
- `/plan-review`: Use `Open questions:` only for ambiguities that affect readiness or require a user/product decision. Put improvements and best-practice recommendations in findings or suggested changes, not questions.
- `/implement`: Ask only when implementation is blocked or the next step risks changing behavior outside the approved spec. Otherwise apply the safest in-scope assumption and report it.
- `/review`: Keep findings as findings. Ask only for user context that cannot be verified from the diff/spec/code and affects the review verdict or recommended fix.

Task update rules:

- `/implement` may update only completed `Implementation` and `Verification` items.
- `/implement` must not create/modify tests, run tests, or mark `Tests` complete.
- `/test` may update only completed `Tests` items.
- Do not add new test scope without user approval.
- If a missing scenario or test gap is found, stop and ask before updating `BDD.md` or `TASKS.md`.

## Workflow by Prompt

### /plan

- Do not implement code.
- Do not modify files before the user approves the final plan and asks to save it.
- Inspect existing code only as needed for compatibility.
- Draft `SPEC`, `TASKS`, and `BDD` content in chat first.
- End with a compact `Final status` block that makes the verdict, required action, and recommended next action unambiguous.
- If the plan is draft-ready with no blocking questions, recommend running `/plan-review` in a new clean session before approval/implementation.
- If clarification is needed, recommend answering the open questions first, then running `/plan-review` in a new clean session.
- After approval, save `SPEC.md`, `TASKS.md`, and `BDD.md` under the canonical path.

### /plan-review

Review the plan/spec for:

- Alignment with the user request
- Alignment between `SPEC.md`, `TASKS.md`, and `BDD.md`
- Compatibility with existing architecture and code
- Ambiguity or missing details
- Scope creep and overengineering
- Best-practice fit
- Security/performance concerns
- Validation strategy
- Implementation readiness

When `/plan-review` needs user-answerable questions, use the exact heading `Open questions:` so the answer extension can detect them.

Default `/plan-review` behavior is review-only. Do not modify files unless the user explicitly asks to update/save/fix the SDD files.

When review discussion results in agreed SDD changes and the user asks to apply them:

- Keep canonical SDD files final-state oriented. `SPEC.md`, `BDD.md`, and `TASKS.md` should describe the current agreed behavior, not the review history.
- Do not persist decision logs or review history into canonical SDD files.
- Remove stale behavior. Keep superseded behavior only when it is intentionally documented as non-scope, rejected, or a constraint.
- Before editing, produce a temporary Decision Summary in chat with: superseded assumption/behavior, new agreed behavior, affected files/sections, stale terms/phrases/concepts to sweep, and expected final state.
- Do not modify SDD files until the user gives apply intent.
- In an apply/recommendation context, natural affirmatives such as "ok", "oke", "yes", "ya", "sip", "lanjut", "approved", "setuju", "go ahead", "fix that", "apply it", or "gas" count as apply intent.
- Suggested replies are examples only; never require exact wording.
- If apply intent is clear, produce the Decision Summary and apply changes in the same response. The summary is a transparency checkpoint, not a second approval gate.
- Wait for approval only if apply intent has not already been clearly given.
- Do not apply yet when the reply is ambiguous, conditional, contradictory, asks for changes, adds constraints, broadens scope, or says not to update.
- Apply fixes in order: `SPEC.md` first, then `BDD.md`, then `TASKS.md`.
- Replace stale behavior rather than documenting "previously A, now B" in canonical sections.
- Perform a consistency sweep across `SPEC.md`, `BDD.md`, and `TASKS.md` for stale terms, phrases, concepts, and conflicting statements before reporting done.
- Do not leave stale or contradictory mentions in canonical SDD files. If a stale or contradictory mention is covered by the approved decision, update or remove it immediately.
- If resolving a stale or contradictory mention requires a new decision outside the approved scope, stop and ask before reporting done.
- Keep old-behavior mentions only when they are intentionally valid, such as non-scope, rejected behavior, historical constraint, or compatibility note.
- Final report must include decisions applied, files/sections updated, stale mentions removed, and remaining old-behavior mentions only when intentionally valid with why they are valid; otherwise state that none remain.
- End every review/apply-fixes response with a compact `Final status` block: verdict, required action, old-behavior sweep result, and exactly one recommended next action.
- Do not end with diagnostic-only sections such as `Remaining old-behavior mentions`; always state whether any remaining mentions require action or are intentionally valid.

### /implement

- Require existing approved SDD files for SDD-required work.
- Implement only requested/approved non-test scope.
- Do not create, modify, or run tests.
- Leave BDD/test work pending for `/test`.
- Run relevant non-test verification commands.
- Update only implementation/verification task checkboxes when appropriate.

### /test

- Read `SPEC.md`, `TASKS.md`, and `BDD.md`.
- Implement tests mapped to existing `BDD-*` scenario IDs.
- Run relevant test commands.
- Fix failures within scope.
- Update only test task checkboxes when appropriate.
- If new behavior/test scope is needed, ask before updating specs/tasks.

### /review

- If the user mentions SPEC, TASKS, BDD, plan, or SDD, review against this workflow.
- Otherwise perform general review focused on correctness, security, performance, maintainability, and compatibility with existing patterns.

## Group-Specific Conventions

### Web

Before editing web files, read `apps/web/AGENTS.md`.

Use existing Vue 3, Vite, TypeScript, Pinia/composable, and project component patterns. Prefer root commands such as:

```bash
make web-typecheck
make web-lint
make web-build
```

Use test commands only in `/test` mode.

### Mobile

Before editing mobile files, read `apps/mobile/AGENTS.md`.

Use existing Flutter, Dart, Riverpod, GoRouter, and project architecture patterns. Preserve layer separation and package import conventions from the app. Prefer root commands such as:

```bash
make mobile-analyze
```

Run code generation only when required by the implementation. Use test commands only in `/test` mode.

### Supabase

Before editing Supabase files, read `supabase/AGENTS.md`.

Use the root `supabase/` directory as the shared source of truth. Do not create app-local migration folders. Check RLS, security, migration ordering, and query performance. Prefer root commands such as:

```bash
make schema-check
make supabase-migrations
```

### Global

For cross-app or monorepo-level changes, read the root `AGENTS.md` and any relevant docs under `docs/development/`.

Prefer root commands and keep changes scoped to the approved plan.
