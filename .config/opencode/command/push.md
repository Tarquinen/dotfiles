---
description: Git commit and push
agent: general
subtask: true
---

Use git commands to commit and push changes. DO NOT create a script.

Arguments provided: "$ARGUMENTS"

If an argument is provided above:
- ONLY commit and push changes in that specific directory
- Do NOT check the current directory or other child directories
- ONLY process the single directory specified

If NO argument is provided above (empty string):
- Check if the current directory is a Git repository and commit and push changes
- If the current directory is not a Git repository, check child directories for Git repositories and commit and push changes in each one

If changes are already committed (git status shows no staged/unstaged changes but branch is ahead of remote), only push to remote without creating a new commit.
