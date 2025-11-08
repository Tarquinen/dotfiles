# Smart Title Plugin for OpenCode

Automatically updates OpenCode session names using smart context selection and **direct AI SDK calls** to GitHub Copilot GPT-5 mini (the same model OpenCode uses!).

## Features

- **Direct AI SDK Integration**: Uses `generateText()` from Vercel AI SDK - no temp sessions needed!
- **GitHub Copilot GPT-5 Mini**: Same fast, efficient model that OpenCode uses for planning
- **Smart Context Extraction**: Includes only essential conversation context (first and last AI messages per turn)
- **Token Optimization**: 95%+ token reduction compared to sending full conversation history
- **Background Processing**: Non-blocking title updates that don't disrupt user experience
- **Clean Implementation**: No temp sessions, no filesystem operations, no UI artifacts

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

1. **Install copilot-api proxy:**
```bash
npm install -g copilot-api
npx copilot-api auth
npx copilot-api start
```

2. **Install plugin dependencies:**
```bash
cd ~/.config/opencode/plugin/smart-title
bun install
```

3. **Enable the plugin in OpenCode config** (`~/.config/opencode/opencode.json`):
```json
{
  "plugin": [
    "./plugin/smart-title"
  ]
}
```

4. **Restart OpenCode** and start chatting!

## How It Works

### Smart Context Selection

The plugin uses an intelligent context selection strategy that:
- Includes ALL user messages (text only)
- Includes the FIRST and LAST assistant response per conversation turn
- Excludes tool calls, images, patches, reasoning blocks, and synthetic content

This approach reduces token usage by ~95% while maintaining conversation coherence.

### Example Context Window

```
User: [user message 1 text]

Assistant (first): [first text from assistant turn 1]
Assistant (final): [last text from assistant turn 1]

User: [user message 2 text]

Assistant (first): [first text from assistant turn 2]
Assistant (final): [last text from assistant turn 2]
```

### Title Generation

- Uses GitHub Copilot GPT-5 mini (fast and efficient)
- Accessed via AI SDK's `generateText()` through copilot-api proxy
- Follows OpenCode's title generation guidelines
- Focuses on action verbs and technical accuracy
- Keeps titles under 50 characters

## Architecture

### Previous Implementation (Deprecated)
❌ Created temporary sessions  
❌ Required filesystem cleanup  
❌ Caused UI artifacts  
❌ Complex error handling  

### Current Implementation
✅ Direct AI SDK calls via `generateText()`  
✅ Uses copilot-api proxy for GitHub Copilot access  
✅ Clean, simple code matching OpenCode's patterns  
✅ No temp sessions or filesystem operations  

## Configuration

### Proxy URL

By default, the plugin connects to `http://localhost:4141/v1`. To customize:

```bash
export COPILOT_API_URL=http://custom-host:port/v1
```

### Rate Limiting

Update interval is handled per-session to avoid excessive API calls.

## Performance

### Token Usage Comparison

**Full context (naive approach):**
- Estimated tokens: 10,000+

**Smart context (this plugin):**
- Estimated tokens: 200-500
- **95%+ token reduction**

### Typical Performance
- Title generation: < 1 second
- API cost: Few cents per session
- Memory overhead: Minimal (periodic cleanup)

## Monitoring

The plugin logs all operations to `/tmp/opencode-smart-title-debug.log`:

```bash
tail -f /tmp/opencode-smart-title-debug.log
```

Typical log output:
```
[SmartTitle] Plugin initialized
[SmartTitle] GitHub Copilot proxy: http://localhost:4141
[SmartTitle] User message detected in session abc123
[SmartTitle] Generating title from 3 turns
[SmartTitle] Updated session abc123 title to: Implementing rate limiting API
```

## Troubleshooting

### copilot-api not running
**Error:** Connection refused to localhost:4141

**Solution:** Start the proxy:
```bash
npx copilot-api start
```

### Authentication issues
**Error:** GitHub Copilot authentication failed

**Solution:** Re-authenticate:
```bash
npx copilot-api auth
```

### Plugin not loading
- Verify the plugin is listed in `opencode.json`
- Check that all dependencies are installed: `bun install`
- Check for TypeScript errors in the debug log

### Title not updating
- Check that copilot-api proxy is running: `curl http://localhost:4141/v1/models`
- Ensure conversation has at least one complete turn (user + assistant)
- Review debug log: `tail -f /tmp/opencode-smart-title-debug.log`

### Want to use a different model?

You can easily switch from GitHub Copilot to Anthropic Claude or OpenAI:

**Anthropic Claude:**
```typescript
import { anthropic } from '@ai-sdk/anthropic'

const result = await generateText({
  model: anthropic('claude-3-5-haiku-20241022'),
  maxTokens: 50,
  messages: [...]
})
```

**OpenAI:**
```typescript
import { openai } from '@ai-sdk/openai'

const result = await generateText({
  model: openai('gpt-4o-mini'),
  maxTokens: 50,
  messages: [...]
})
```

Don't forget to install the provider package and set the API key!

## Development

### Project Structure
```
smart-title/
├── index.ts           # Main plugin implementation
├── package.json       # Dependencies
├── tsconfig.json      # TypeScript configuration
└── README.md         # This file
```

### Testing locally
After making changes, restart OpenCode to reload the plugin.

## Technical Details

### How It Works

1. **Event Listener**: Listens for `message.updated` events from user messages
2. **Context Extraction**: Retrieves and formats conversation context (first/last assistant messages per turn)
3. **AI Call**: Uses `generateText()` from AI SDK to call GitHub Copilot GPT-5 mini via copilot-api proxy
4. **Title Update**: Updates session via OpenCode client API

### Why copilot-api?

GitHub Copilot doesn't have an official AI SDK provider. The `copilot-api` package:
- Provides an OpenAI-compatible API for GitHub Copilot
- Handles GitHub OAuth authentication
- Runs locally as a proxy server
- Supports all Copilot models including GPT-5 mini

### Stack

- **AI SDK**: Vercel AI SDK for `generateText()`
- **Provider**: `@ai-sdk/openai-compatible` for custom OpenAI-compatible APIs
- **Proxy**: `copilot-api` for GitHub Copilot access
- **Model**: GitHub Copilot GPT-5 mini (same as OpenCode uses)

## Future Enhancements

- Automatic copilot-api proxy management (start/stop with plugin)
- Fallback to other models when proxy is unavailable
- Context summarization for very long conversations
- User-configurable update frequency
- Multi-language support
- Title history tracking

## License

MIT

## Credits

Built for OpenCode based on research into optimal context selection strategies for LLM-powered title generation.
