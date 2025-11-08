# Smart Title Plugin

Auto-generates meaningful session titles for your OpenCode conversations using AI.

## What It Does

Analyzes your conversation and creates a short, descriptive title (≤50 chars) that updates automatically as you chat.

## Setup

**1. Install dependencies**

```bash
cd ~/.config/opencode/plugin/smart-title
bun install
```

**2. Set your API key**

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Pick one:
export OPENAI_API_KEY=sk-...              # OpenAI (recommended)
export GOOGLE_GENERATIVE_AI_API_KEY=...  # Google Gemini (free tier)
export ANTHROPIC_API_KEY=sk-ant-...      # Anthropic Claude
```

For GitHub Copilot: `npx copilot-api auth` (no API key needed)

Then reload: `source ~/.bashrc`

**3. Configure provider**

```bash
cp .env.example .env
```

Edit `.env`:

```env
AI_PROVIDER=gemini        # openai, gemini, anthropic, or copilot
AI_MODEL=gemini-2.5-flash # optional, has sensible defaults
```

**4. Enable plugin**

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["./plugin/smart-title"]
}
```

**5. Restart OpenCode**

## Available Models

**OpenAI:** `gpt-5-nano` (default), `gpt-5-mini`, `gpt-5`, `gpt-5-pro`, `o4-mini`  
**Gemini:** `gemini-2.5-flash` (default), `gemini-2.5-flash-lite`, `gemini-2.5-pro`  
**Anthropic:** `claude-sonnet-4-5` (default), `claude-haiku-4-5`, `claude-opus-4-1`  
**Copilot:** `gpt-5-mini` (default), `gpt-5`

## Troubleshooting

Enable debug logging in `.env`:

```env
DEBUG=true
```

Check logs: `tail -f /tmp/opencode-smart-title-debug.log`

