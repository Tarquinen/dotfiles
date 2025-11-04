---
description: Close a GitHub issue using gh CLI
---

# Close GitHub Issue

You are tasked with closing a GitHub issue using the GitHub CLI (gh).

## Process

### Step 1: Parse Arguments
Analyze the provided arguments to determine:
- Issue number (required)
- Repository (if specified)
- Optional comment to add when closing

Arguments format examples:
- Just issue number: `42`
- With repo: `owner/repo 42`
- With comment: `42 | Fixed in latest release`
- With repo and comment: `owner/repo 42 | Fixed in PR #123`

### Step 2: Determine Repository
If no repository is specified in arguments:
1. Check if current directory is a git repository
2. If yes, use the current repository
3. If no, ask user which repository the issue belongs to

### Step 3: Validate Issue Number
- Ensure issue number is provided
- If not provided, ask user for the issue number
- Optionally, you can list open issues to help user choose

### Step 4: Close Issue
Use the bash tool to execute:
```bash
gh issue close ISSUE_NUMBER --repo OWNER/REPO
```

If a comment was provided, add it before closing:
```bash
gh issue comment ISSUE_NUMBER --repo OWNER/REPO --body "COMMENT" && gh issue close ISSUE_NUMBER --repo OWNER/REPO
```

### Step 5: Confirm Success
Display confirmation that the issue was closed, including:
- Issue number
- Issue title (if available)
- Repository
- Link to the closed issue

## Guidelines
- Always validate that gh CLI is available
- If gh auth status fails, inform user they need to authenticate
- Provide clear error messages if issue doesn't exist
- Default to current repository if in a git directory
- Optionally show issue details before closing for confirmation
- Support adding a comment when closing (useful for explaining resolution)

## Examples

### Example 1: Close issue in current repo
```
/gh-issue-close 42
```

### Example 2: Close issue in specific repo
```
/gh-issue-close owner/repo 42
```

### Example 3: Close with comment
```
/gh-issue-close 42 | Fixed in v2.1.0 release
```

### Example 4: Close in specific repo with comment
```
/gh-issue-close owner/repo 42 | Resolved by PR #123
```

### Example 5: Interactive (no arguments)
```
/gh-issue-close
```
Then prompt for issue number and optional comment.

## Command Reference
The gh CLI commands used:
```bash
# Close an issue
gh issue close ISSUE_NUMBER [--repo OWNER/REPO]

# Add comment and close
gh issue comment ISSUE_NUMBER --body "COMMENT" [--repo OWNER/REPO]
gh issue close ISSUE_NUMBER [--repo OWNER/REPO]
```

## Additional Features
- Could optionally ask for confirmation before closing
- Could show issue details (title, description) before closing
- Could suggest related issues that might also need closing

**user_request**

$ARGUMENTS
