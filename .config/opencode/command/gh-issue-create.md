---
description: Create a GitHub issue using gh CLI
---

# Create GitHub Issue

You are tasked with creating a GitHub issue using the GitHub CLI (gh).

## Process

### Step 1: Parse Arguments
Analyze the provided arguments to determine:
- Issue title
- Issue body/description
- Target repository (if specified)

Arguments format can be:
- Just a title: "Fix login bug"
- Title and body: "Fix login bug | Users can't login after password reset"
- With repo: "owner/repo Fix login bug | Users can't login"

### Step 2: Determine Repository
If no repository is specified in arguments:
1. Check if current directory is a git repository
2. If yes, use the current repository
3. If no, ask user which repository to create the issue in (show list of available repos)

### Step 3: Interactive Prompts (if needed)
If title is not provided in arguments:
- Ask for issue title
- Ask for issue description/body
- Confirm which repository to use

### Step 4: Create Issue
Use the bash tool to execute:
```
gh issue create --repo OWNER/REPO --title "TITLE" --body "BODY"
```

### Step 5: Confirm Success
Display the created issue URL to the user.

## Guidelines
- Always validate that gh CLI is available
- If gh auth status fails, inform user they need to authenticate
- Provide clear, helpful error messages
- Support both interactive and non-interactive modes
- Default to current repository if in a git directory

## Examples

### Example 1: Full command
```
/gh-issue-create Fix authentication bug | Users cannot log in after password reset. Error appears in console.
```

### Example 2: With repository specified
```
/gh-issue-create owner/repo Add dark mode | Implement dark mode toggle in settings
```

### Example 3: Interactive (no arguments)
```
/gh-issue-create
```
Then prompt for title, body, and repository.

**user_request**

$ARGUMENTS
