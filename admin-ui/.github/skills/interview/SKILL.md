---
name: interview
description: Interview user in-depth to create a detailed spec. Use when user wants to create a detailed specification, needs requirements gathering, wants comprehensive planning, or says /interview.
argument-hint: [instructions]
allowed-tools: AskUserQuestion, Write
---

# In-Depth Requirements Interview

Follow the user instructions and interview me in detail using the AskUserQuestion tool about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. Make sure the questions are not obvious - be very in-depth and continue interviewing me continually until it's complete. Then, write the spec to a file.

<instructions>$ARGUMENTS</instructions>

## Interview Guidelines

### Question Categories

Interview across ALL of these areas. Do not skip any category:

1. **Project/Feature Overview**
   - What problem does this solve?
   - Who are the users?
   - What's the scope and boundaries?

2. **Technical Implementation**
   - Technology stack preferences/constraints
   - Architecture patterns
   - Data models and storage
   - API design
   - Integration points

3. **UI & UX**
   - User flows
   - Interface requirements
   - Accessibility needs
   - Responsive design
   - Error states and feedback

4. **Edge Cases & Error Handling**
   - What could go wrong?
   - How should errors be handled?
   - Validation requirements
   - Security considerations

5. **Concerns & Constraints**
   - Performance requirements
   - Scalability needs
   - Budget/time constraints
   - Technical debt considerations

6. **Tradeoffs & Alternatives**
   - What approaches were considered?
   - Why this approach over others?
   - What are you willing to sacrifice?

7. **Success Criteria**
   - How do you know it's done?
   - What does success look like?
   - Testing requirements

### Interview Rules

1. **Ask non-obvious questions** - probe for hidden requirements
2. **Use AskUserQuestion tool** with 2-4 options per question
3. **Continue until complete** - don't stop early
4. **Drill deeper** on vague answers
5. **Challenge assumptions** - ask "why" and "what if"
6. **One category at a time** - be systematic

### Output

After interviewing is complete, write a comprehensive SPEC.md file containing:

- Feature/Project name
- Overview and objectives
- User stories
- Technical requirements
- UI/UX requirements
- Data models
- API contracts (if applicable)
- Edge cases and error handling
- Constraints and tradeoffs
- Success criteria
- Out of scope items

Write the spec to: `docs/specs/{feature-name}/SPEC.md` or ask user for preferred location.
