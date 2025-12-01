---
description: Create a release - commit, branch, PR, version bump, tag, and publish to npm
agent: general
subtask: true
---

# Release Command

Create a full release for this package. This includes:
1. Reviewing current changes
2. Creating a feature branch
3. Committing changes with a descriptive message
4. Bumping the version in package.json
5. Creating a git tag for the version
6. Pushing the branch and tag to remote
7. Creating a PR
8. Waiting for CI checks to pass
9. Merging the PR
10. Publishing to npm

## Arguments

Arguments provided: "$ARGUMENTS"

- If a version bump type is provided (patch, minor, major), use that
- If no argument is provided, default to "patch" (0.0.1 bump)

## Process

### Step 1: Review Changes
Run `git status` and `git diff` to understand what changes need to be released.
Summarize the changes to determine an appropriate commit message.

### Step 2: Create Branch
Create a descriptive branch name based on the changes (e.g., `fix/description` or `feat/description`).

### Step 3: Commit Changes
Stage all relevant changed files and commit with a clear, descriptive message that explains the "why" not just the "what". Make sure to fully analyze all changes for the commit message.

### Step 4: Version Bump
- Read the current version from package.json
- Increment based on argument (patch by default)
- Update package.json
- Run `npm install --package-lock-only` to sync package-lock.json
- **Check README.md for version references** that may need updating:
  - Search for patterns like `@package-name@X.Y.Z` (version pinning examples)
  - Search for version numbers in install commands or code blocks
  - If found, update them to the new version
  - Common patterns to check:
    - `"@tarquinen/opencode-dcp@0.3.10"` → update to new version
    - Version numbers in example configs or install instructions
- Commit the version bump with message like "v{version} - Bump version"

### Step 5: Create Annotated Tag with Release Notes
Create an annotated git tag that includes a summary of changes:
- Review all commits since the last tag using `git log $(git describe --tags --abbrev=0)..HEAD --oneline`
- Create an annotated tag with a descriptive message summarizing the key changes
- Use `git tag -a v{version} -m "Release v{version}" -m "" -m "Changes:" -m "- {summary of each significant change}"`
- The tag message should include:
  - A brief summary line (e.g., "Release v0.3.28 - Add context pruning improvements")
  - A list of key changes/features/fixes

### Step 6: Push and Create PR
- Push the branch with `git push -u origin {branch} --tags`
- Create a PR using `gh pr create` with a summary of changes. Make sure to fully analyze all changes for the PR description.

### Step 6b: Create GitHub Release
After the PR is merged and tag is pushed, create a GitHub Release:
```bash
gh release create v{version} --title "v{version} - {brief description}" --notes "## What's Changed

- {Feature/Fix 1}
- {Feature/Fix 2}
- ...

**Full Changelog**: https://github.com/Tarquinen/opencode-dynamic-context-pruning/compare/v{previous_version}...v{version}"
```
This provides a rich release page with:
- A descriptive title
- Bullet points of what changed
- Automatic changelog link

### Step 7: Wait for CI
Use `gh pr checks {pr_number} --watch` to wait for CI checks to complete.
Use a timeout of 300000ms (5 minutes).

### Step 8: Merge PR
Once checks pass, merge the PR with `gh pr merge {pr_number} --merge --delete-branch`.
If branch protection blocks the merge, try with `--admin` flag.

### Step 9: Publish to npm
Pull the latest changes and run `npm publish --access public`.

### Step 10: Verify
Confirm the new version is live on npm with `npm view @tarquinen/opencode-dcp version`.

Verify the GitHub release was created at: https://github.com/Tarquinen/opencode-dynamic-context-pruning/releases

## Guidelines
- Use 30 second timeouts for bash commands unless waiting for CI
- If any step fails, report the error clearly and stop
- Provide a summary at the end with:
  - Version released
  - PR URL
  - npm package URL
