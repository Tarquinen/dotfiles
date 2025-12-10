---
description: Review code changes and merge a PR - no npm publish or git releases
agent: general
subtask: true
---

# Merge Command

Review and merge code changes. This is a simplified workflow that:
1. Reviews current changes
2. Creates a feature branch
3. Commits changes (multiple commits if logically separate)
4. Pushes and creates a PR
5. Waits for CI
6. Merges the PR

**No version bumps, tags, npm publish, or GitHub releases.**

## Arguments

Arguments provided: "$ARGUMENTS"

- Optional: branch name prefix or description for the changes

## Process

### Step 1: Review Changes
Run `git status` and `git diff` to understand what changes exist.
Analyze the changes to determine:
- How many logical commits should be made
- Clear, concise commit messages for each

### Step 2: Create Branch
Create a descriptive branch name based on the changes:
- `fix/brief-description` for bug fixes
- `feat/brief-description` for features
- `refactor/brief-description` for refactoring
- `chore/brief-description` for maintenance

### Step 3: Commit Changes
Stage and commit changes with clear, non-verbose messages.

**Commit message guidelines:**
- Use imperative mood: "Add feature" not "Added feature"
- Keep subject line under 50 characters
- No period at the end
- Focus on what and why, not how

**Multiple commits if appropriate:**
- Separate unrelated changes into distinct commits
- Group related changes together
- Each commit should be atomic and logical

Examples of good commit messages:
- `Fix null check in user validation`
- `Add retry logic for API calls`
- `Remove deprecated helper functions`
- `Update dependencies`

### Step 4: Push and Create PR
- Push the branch: `git push -u origin {branch}`
- Create PR with `gh pr create --title "{concise title}" --body "{brief summary}"`
- PR title should match the primary commit message if single commit
- PR body: 2-3 bullet points max summarizing the changes

### Step 5: Wait for CI
Use `gh pr checks {pr_number} --watch` to wait for CI checks.
Timeout: 30000ms (30 seconds).

### Step 6: Merge PR
Once checks pass, merge with `gh pr merge {pr_number} --merge --delete-branch`.
If branch protection blocks, try with `--admin` flag.

## Guidelines
- Use 30 second timeouts for bash commands unless waiting for CI
- If any step fails, report the error clearly and stop
- Keep commit messages concise - avoid walls of text
- Provide a summary at the end with:
  - Number of commits
  - PR URL
  - Merge status
