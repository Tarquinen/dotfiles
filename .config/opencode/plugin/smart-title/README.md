# Smart Title Plugin

Automatically generates meaningful session titles for OpenCode conversations using AI.

## How It Works

Every time you send a message:
1. Extracts key conversation context (first and last assistant responses per turn)
2. Sends it to GitHub Copilot GPT-5 mini
3. Generates a concise, descriptive title (≤50 chars)
4. Updates your session title automatically

Uses 95% fewer tokens than sending full conversation history while maintaining accuracy.

## Setup

### 1. Authenticate with GitHub Copilot (one-time)

Requires active GitHub Copilot subscription.

```bash
npx copilot-api auth
```

### 2. Install dependencies

```bash
cd ~/.config/opencode/plugin/smart-title
bun install
```

### 3. Enable plugin

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "./plugin/smart-title"
  ]
}
```

### 4. Restart OpenCode

Done! Session titles will now update automatically.

## Configuration

**Custom proxy URL** (optional):

```bash
export COPILOT_API_URL=http://custom-host:port
```

Default: `http://localhost:4141`

**Title update threshold** (optional):

```bash
export TITLE_UPDATE_THRESHOLD=2
```

Controls how often the title updates based on user messages:
- `1` (default): Update on every user message
- `2`: Update every 2 user messages
- `3`: Update every 3 user messages
- etc.

This can help reduce API calls while still keeping titles relatively up-to-date.

## Using a Different AI Model

Switch to other providers by editing `index.ts`:

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
