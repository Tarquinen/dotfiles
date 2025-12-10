---
description: Review code changes and create a PR - no CI wait or merge
agent: general
subtask: true
---

# PR Command

Review and create a pull request for code changes. This is a simplified workflow that:
1. Reviews current changes
2. Creates a feature branch
3. Commits changes (multiple commits if logically separate)
4. Pushes and creates a PR

**Does not wait for CI or merge the PR.**

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

## Guidelines
- Use 30 second timeouts for bash commands
- If any step fails, report the error clearly and stop
- Keep commit messages concise - avoid walls of text
- Provide a summary at the end with:
  - Number of commits
  - PR URL
