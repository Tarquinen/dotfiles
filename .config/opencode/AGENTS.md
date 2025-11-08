When asked to get docs or up to date information, you should use the context7 MCP.
When you need information from github, you should use the ghgrep MCP.
If a tool use fails due to permissions, inform the user what you did not have permission to do and ask them to do it for you.

## Subagent Usage

**VITALLY IMPORTANT**: Use subagents whenever possible to cut down on context going into the main session. Whenever a task is close to fitting the description of one of the available subagents, **PRIORITIZE using them to solve it**. This reduces token usage and keeps the main session focused and efficient. Even if you think you can handle a task directly, prefer delegating to the appropriate subagent if one exists for that purpose.

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE. Here is an example illustrating how to execute 3 parallel file reads in this chat environnement:

json
{
    "recipient_name": "multi_tool_use.parallel",
    "parameters": {
        "tool_uses": [
            {
                "recipient_name": "functions.read",
                "parameters": {
                    "filePath": "path/to/file.tsx"
                }
            },
            {
                "recipient_name": "functions.read",
                "parameters": {
                    "filePath": "path/to/file.ts"
                }
            },
            {
                "recipient_name": "functions.read",
                "parameters": {
                    "filePath": "path/to/file.md"
                }
            }
        ]
    }
}
