---
description: List GitHub issues with filters using gh CLI
---

Use the bash tool to list GitHub issues with the gh CLI. Parse the arguments and execute the appropriate gh issue list command.

Arguments provided: "$ARGUMENTS"

Execute the gh issue list command with the following process:

1. Parse arguments to determine filters (state, assignee, labels, repo, etc.)
2. Build the gh command with appropriate flags
3. Execute the command
4. Display the results clearly formatted

After executing, provide a summary including:
- The command that was executed
- Total count of issues
- The formatted list of issues

## Process

### Step 1: Parse Arguments
Analyze the provided arguments to determine filters:
- Repository (if specified)
- State filter: `open`, `closed`, `all`
- Assignee filter: `@me`, username, or none
- Label filters
- Author filter
- Limit (number of issues to show)

Arguments format examples:
- No args: List open issues in current repo
- `closed`: List closed issues
- `@me`: List issues assigned to you
- `owner/repo`: List issues in specific repo
- `owner/repo closed @me`: List closed issues assigned to you in specific repo
- `label:bug`: List issues with bug label
- `author:username`: List issues by specific author

### Step 2: Determine Repository
If no repository is specified in arguments:
1. Check if current directory is a git repository
2. If yes, use the current repository
3. If no, list issues across all repositories the user has access to

### Step 3: Build gh Command
Construct the `gh issue list` command with appropriate flags:
- `--repo OWNER/REPO` if repo specified
- `--state STATE` for open/closed/all
- `--assignee ASSIGNEE` for filtering by assignee
- `--label LABEL` for filtering by label
- `--author AUTHOR` for filtering by author
- `--limit N` for number of results (default: 30)

### Step 4: Execute Command
Use the bash tool to execute the constructed gh command.

### Step 5: Display Results
Present the results in a clear, readable format. The gh CLI output includes:
- Issue number
- Title
- Labels
- Updated time

### Step 6: Return Results to Main Context
After executing the command, return a summary that includes:
- What command was executed (with all filters applied)
- The formatted list of issues found
- Total count of issues
- Any notes about the filters used or repository queried

## Guidelines
- Always validate that gh CLI is available
- If gh auth status fails, inform user they need to authenticate
- Default to showing open issues if no state specified
- Default to current repository if in a git directory
- Provide helpful suggestions if no issues match the filters
- Support common shortcuts like `@me` for current user

## Examples

### Example 1: List open issues in current repo
```
/gh-issue-list
```

### Example 2: List all issues (open and closed)
```
/gh-issue-list all
```

### Example 3: List issues assigned to you
```
/gh-issue-list @me
```

### Example 4: List closed issues in specific repo
```
/gh-issue-list owner/repo closed
```

### Example 5: List issues with specific label
```
/gh-issue-list label:bug
```

### Example 6: Combine filters
```
/gh-issue-list owner/repo open @me label:bug
```

### Example 7: List issues by author
```
/gh-issue-list author:username
```

## Command Reference
The gh CLI command structure:
```bash
gh issue list [--repo OWNER/REPO] [--state {open|closed|all}] [--assignee ASSIGNEE] [--label LABEL] [--author AUTHOR] [--limit N]
```

**user_request**

$ARGUMENTS
