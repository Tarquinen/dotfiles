---
description: smart codebase reduce
---

Review the codebase to identify a **single highest-impact opportunity** to refactor:

- remove duplication
- remove dead or unused paths
- simplify / inline needless abstractions
- restructure code that would benefit from it

“Highest impact” means the change:

- reduces total lines of code (including tests/docs where applicable)
- does NOT increase cognitive complexity
- respects all architecture guardrails and domain ownership rules
- improves maintainability and code patterns

Pick ONE target. Trace its full read/write/usage flow and propose a consolidation or elimination.
If you detect opportunities to merge multiple closely related files into fewer files **without breaking boundaries**, include that in the proposal.

> DO NOT IMPLEMENT STRAIGHT AWAY.
> The user must approve your refactor plan before you edit any files.

## Output

1. Why this target
   - What problem it solves (duplication, dead code, over-abstraction, etc.)

2. Current flow (succinct)
   - What modules/functions are involved
   - How data flows through them (read/write/usage)
   - Any important contracts or public APIs relied upon

3. Minimal refactor plan
   - Concrete steps to remove/merge/simplify
   - Which files/functions will be touched
   - How you’ll avoid changing observable behavior

4. Safety checks
   - Which tests to run (files or suites)
   - Any type-checking / build steps
   - Specific risks to watch for (public API changes, cross-boundary imports, etc.)

5. Detailed refactor plan (narrative)
   - Expand the minimal plan into a step-by-step execution guide
   - Make it clear enough that another engineer could follow it
   - Do NOT use the write tool for this step; this belongs in your message only

6. TL;DR for the user
   - 2–4 bullet summary:
     - what’s being simplified and why
     - how better is the proposition compared to current implementation
     - which areas of the app are affected
     - expected risk level and what to look out for

## Constraints

- Do NOT add new abstractions unless they CLEARLY shrink code, reduce duplication without increasing coupling or overall improve pattern and practices
- Prefer INLINING small, one-off abstractions over inventing new generic helpers.
- Avoid changing external/public APIs unless the plan explicitly calls this out and justifies the change
- Do not touch tests except when:
  - they directly reference deleted code, or
  - they are being simplified alongside the refactor
- You MUST update the user about your findings and possible candidates as you discover/rule them out
- ALWAYS self vet the refactor target with an extra research validation pass once the plan is formulated
- Do not use subagents for this task
