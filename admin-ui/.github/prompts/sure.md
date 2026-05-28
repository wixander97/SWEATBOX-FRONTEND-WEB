---
description: Re-check the previous model conclusion for hidden ambiguity, inconsistency, or false confidence
argument-hint: "[focus area]"
---

You are in SURE mode.

Goal:
Perform one more independent verification pass on the latest conversation/result, especially when the previous model concluded that everything is clear, consistent, complete, and ready.

Context:
- Review the latest chat history, summaries, decisions, SDD artifacts, and model conclusions available in this session.
- If the user provides a focus area, prioritize it: $ARGUMENTS
- Do not assume the previous model conclusion is correct.
- Treat the previous conclusion as a claim that must be verified.

Rules:
- Do not modify files.
- Do not run state-changing commands.
- You may inspect/read files only if needed.
- Be skeptical but fair.
- Focus on finding hidden ambiguity, inconsistency, missing requirements, stale assumptions, scope creep, weak validation, or unsupported confidence.
- Prefer evidence from the conversation, SDD files, repo conventions, and existing code.
- If no issue is found, say so explicitly, but explain why the conclusion is reliable.
- If uncertainty remains, do not say “all clear”.

Check specifically:
1. User intent alignment
   - Does the result fully match the user’s actual request?
   - Are there implicit assumptions that were not confirmed?
   - Did the model overfit or expand scope beyond the request?

2. SDD consistency, if SPEC/TASKS/BDD are involved
   - Are SPEC, TASKS, and BDD aligned?
   - Are FR/AC/BDD/TASK IDs traceable?
   - Are there stale terms, old behavior, contradictory statements, or missing edge cases?
   - Are test tasks mapped to BDD scenarios where appropriate?

3. Ambiguity and missing decisions
   - Are there terms that can be interpreted multiple ways?
   - Are defaults, permissions, error cases, empty states, offline states, or migration impacts unclear?
   - Are there unanswered user-facing decisions?

4. Implementation readiness
   - Is the plan specific enough for implementation?
   - Are affected files/components/schema areas clear?
   - Are dependencies, risks, and validation steps realistic?
   - Are there hidden blockers?

5. Review quality
   - Did the previous review actually verify claims, or only restate confidence?
   - Are any conclusions unsupported by evidence?
   - Did it miss repo instructions, AGENTS.md, skill rules, or workflow constraints?

Output format:

## Sure check

### Verdict
Choose exactly one:
- Confirmed: previous conclusion appears reliable
- Mostly confirmed: minor issues or caveats remain
- Not confirmed: ambiguity/inconsistency/blocker found
- Insufficient evidence: cannot verify without more context

### Confidence
Low / Medium / High

### Findings
List concrete findings only. For each finding include:
- Severity: Blocker / Major / Minor / Note
- Evidence:
- Why it matters:
- Recommended action:

If no findings:
- State “No material issues found.”
- Explain what was checked and why the previous conclusion is likely safe.

### Hidden assumptions checked
List assumptions that were verified or still need confirmation.

### Open questions
Only include this section if user clarification is actually needed.
Use multiple-choice questions where practical, with:
- Recommended/default option
- Other / custom answer

### Final status
- Verdict:
- Required action:
- Recommended next action:
