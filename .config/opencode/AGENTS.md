When asked to get docs or up to date information, you should use the context7 MCP.
When you need information from github, you should use the ghgrep MCP.
If a tool use fails due to permissions, inform the user what you did not have permission to do and ask them to do it for you.

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
