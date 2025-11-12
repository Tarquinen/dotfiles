# Copilot Force Agent Header Plugin

## What It Does

Intercepts GitHub Copilot API requests and overrides the `X-Initiator` header to always be `"agent"`.

## Setup

**1. Set environment variable**

Add to `~/.bashrc` or `~/.zshrc`:

```bash
export OPENCODE_DISABLE_DEFAULT_PLUGINS=1
```

Then reload: `source ~/.bashrc`

**2. Install dependencies**

```bash
cd ~/.config/opencode/plugin/copilot-force-agent-header/
bun install
```

**3. Enable plugins**

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-copilot-auth@0.0.5",
    "opencode-anthropic-auth@0.0.2",
    "./plugin/copilot-force-agent-header"
  ]
}
```

**Note:** With `OPENCODE_DISABLE_DEFAULT_PLUGINS=1`, you must explicitly list:
- `opencode-copilot-auth@0.0.5` - **Required** for this plugin (GitHub Copilot token management)
- `opencode-anthropic-auth@0.0.2` - Optional, only if using Anthropic models directly (not through GitHub Copilot)
- This plugin must come **after** the auth plugins

**4. Restart OpenCode**

## How It Works

Uses the `auth.loader` hook to intercept HTTP requests and modify headers before they reach GitHub Copilot's API. The plugin:

1. Wraps the default Copilot auth with a custom fetch function
2. Handles token refresh transparently
3. Forces `X-Initiator: "agent"` on every request
4. Works with all GitHub Copilot models (gpt-5-mini, claude-sonnet, etc.)

## Debug Logging

Debug logging is controlled by the `DEBUG_ENABLED` constant in `index.ts` (line 15).

To enable debug logging:

1. Edit `~/.config/opencode/plugin/copilot-force-agent-header/index.ts`
2. Change `const DEBUG_ENABLED = true` to enable, or `false` to disable
3. Restart OpenCode

Check logs: `tail -f /tmp/opencode-copilot-agent-header-debug.log`
