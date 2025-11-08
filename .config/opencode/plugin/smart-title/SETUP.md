# Smart Title Plugin Setup

This plugin now uses **direct AI SDK calls** to GitHub Copilot GPT-5 mini, eliminating the need for temporary sessions!

## Requirements

The plugin uses the `copilot-api` proxy to access GitHub Copilot's models via an OpenAI-compatible API.

## Setup Steps

### 1. Install copilot-api

```bash
npm install -g copilot-api
```

### 2. Authenticate with GitHub Copilot

```bash
npx copilot-api auth
```

This will open your browser to authenticate with GitHub Copilot. You need an active GitHub Copilot subscription.

### 3. Start the copilot-api proxy

```bash
npx copilot-api start
```

The proxy will run on `http://localhost:4141` by default.

**Note:** You need to keep this proxy running for the plugin to work. Consider running it in a separate terminal or as a background service.

### 4. (Optional) Run proxy as a background service

#### Using systemd (Linux)

Create `/etc/systemd/system/copilot-api.service`:

```ini
[Unit]
Description=GitHub Copilot API Proxy
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
ExecStart=/usr/bin/npx copilot-api start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable copilot-api
sudo systemctl start copilot-api
```

#### Using screen/tmux

```bash
screen -dmS copilot-api npx copilot-api start
# or
tmux new-session -d -s copilot-api 'npx copilot-api start'
```

### 5. Verify the proxy is running

```bash
curl http://localhost:4141/v1/models
```

You should see a list of available models including `gpt-5-mini`.

## Configuration

### Custom proxy URL

If you run the proxy on a different port or host, set the `COPILOT_API_URL` environment variable:

```bash
export COPILOT_API_URL=http://localhost:8080/v1
```

Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.) to make it permanent.

## How It Works

1. **No more temp sessions!** The plugin now calls the AI SDK's `generateText()` directly
2. Uses GitHub Copilot GPT-5 mini via the copilot-api proxy
3. The proxy handles authentication with GitHub Copilot
4. Much cleaner implementation with no filesystem operations

## Troubleshooting

### "Connection refused" error

The copilot-api proxy is not running. Start it with:
```bash
npx copilot-api start
```

### "Authentication failed"

Re-authenticate with GitHub Copilot:
```bash
npx copilot-api auth
```

### Check the debug log

View the plugin's debug log:
```bash
tail -f /tmp/opencode-smart-title-debug.log
```

## Benefits Over Previous Implementation

✅ **No temporary sessions** - No more workarounds or filesystem cleanup  
✅ **Cleaner code** - Simpler implementation using standard AI SDK patterns  
✅ **No UI artifacts** - Temp sessions no longer appear in the sidebar  
✅ **Better error handling** - Direct control over AI calls  
✅ **Matches OpenCode pattern** - Same approach OpenCode uses internally  

## Alternative: Use a Different Model

If you don't want to use GitHub Copilot, you can easily switch to another provider:

### Anthropic Claude

```typescript
import { anthropic } from '@ai-sdk/anthropic'

const result = await generateText({
  model: anthropic('claude-3-5-haiku-20241022'),
  // ... rest of config
})
```

### OpenAI

```typescript
import { openai } from '@ai-sdk/openai'

const result = await generateText({
  model: openai('gpt-4o-mini'),
  // ... rest of config
})
```

Just update the import and model in `index.ts` and set the appropriate API key environment variable.
