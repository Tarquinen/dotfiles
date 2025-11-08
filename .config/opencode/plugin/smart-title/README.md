# Smart Title Plugin for OpenCode

Automatically generates meaningful session titles for your OpenCode conversations using AI.

## What It Does

Every time you send a message, the plugin:
1. Extracts key conversation context (first and last assistant responses per turn)
2. Sends it to GitHub Copilot GPT-5 mini
3. Generates a concise, descriptive title (≤50 chars)
4. Updates your session title automatically

This uses 95% fewer tokens than sending full conversation history while maintaining accuracy.

## Setup

### 1. Install and start copilot-api proxy

Requires active GitHub Copilot subscription.

```bash
npm install -g copilot-api
npx copilot-api auth
npx copilot-api start
```

Keep the proxy running in a separate terminal or as a background service.

### 2. Install plugin dependencies

```bash
cd ~/.config/opencode/plugin/smart-title
bun install
```

### 3. Enable in OpenCode config

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "./plugin/smart-title"
  ]
}
```

### 4. Restart OpenCode

That's it! Titles will now update automatically as you chat.

## Configuration

### Custom proxy URL

Default: `http://localhost:4141/v1`

To change:
```bash
export COPILOT_API_URL=http://custom-host:port/v1
```

## Troubleshooting

### Proxy not running
```bash
npx copilot-api start
```

### Authentication failed
```bash
npx copilot-api auth
```

### Check debug log
```bash
tail -f /tmp/opencode-smart-title-debug.log
```

### Verify proxy is working
```bash
curl http://localhost:4141/v1/models
```

## Using a Different AI Model

The plugin uses GitHub Copilot by default, but you can switch to other providers by editing `index.ts`:

**Anthropic Claude:**
```typescript
import { anthropic } from '@ai-sdk/anthropic'

const result = await generateText({
  model: anthropic('claude-3-5-haiku-20241022'),
  messages: [...]
})
```

**OpenAI:**
```typescript
import { openai } from '@ai-sdk/openai'

const result = await generateText({
  model: openai('gpt-4o-mini'),
  messages: [...]
})
```

Install the provider package and set the API key environment variable.

## How It Works

The plugin listens for user messages, extracts conversation context (first/last assistant responses per turn), sends it to the AI model via the Vercel AI SDK, and updates the session title. Runs in the background without blocking your workflow.

## License

MIT
