---
description: Reviews the last commit for code quality, correctness, and potential issues
agent: general
subtask: true
---

# Review Last Commit

Review the most recent commit for code quality, correctness, and potential issues.

## Process

### Step 1: Get Last Commit Info

Run the following to understand what was changed:
- `git log -1 --stat` to see the commit message and files changed
- `git show --no-stat` to see the actual diff

### Step 2: Analyze Changes

For each file changed, evaluate:

**Code Quality**
- Is the code clean and readable?
- Are variable/function names descriptive?
- Is there unnecessary complexity?
- Does it follow existing patterns in the codebase?

**Correctness**
- Does the logic appear correct?
- Are edge cases handled?
- Are there potential bugs or issues?
- Is error handling adequate?

**Security**
- Any hardcoded secrets or credentials?
- Input validation issues?
- Potential injection vulnerabilities?

**Performance**
- Any obvious performance issues?
- Unnecessary loops or allocations?
- Missing indexes or inefficient queries?

### Step 3: Provide Feedback

Summarize your findings:

1. **Overview** - Brief description of what the commit does
2. **Looks Good** - Things done well
3. **Concerns** - Any issues or potential problems found
4. **Suggestions** - Improvements to consider (if any)

## Guidelines

- Be constructive and specific
- Reference file:line when pointing out issues
- Focus on what matters - don't nitpick style unless it impacts readability
- If the commit looks good, say so briefly and move on
