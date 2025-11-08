#!/bin/bash
# Check if copilot-api is running and show status

PROXY_URL="${COPILOT_API_URL:-http://localhost:4141}"
API_URL="${PROXY_URL}/v1/models"

echo "🔍 Checking GitHub Copilot API proxy status..."
echo "   URL: $PROXY_URL"
echo ""

# Check if proxy is responding
if curl -s --connect-timeout 3 "$API_URL" > /dev/null 2>&1; then
    echo "✅ copilot-api is RUNNING"
    echo ""
    echo "Available models:"
    curl -s "$API_URL" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -10
    echo ""
    echo "📊 Usage stats:"
    curl -s "${PROXY_URL}/usage" 2>/dev/null || echo "   (usage endpoint not available)"
else
    echo "❌ copilot-api is NOT RUNNING"
    echo ""
    echo "To start the proxy:"
    echo "   npx copilot-api start"
    echo ""
    echo "If not installed:"
    echo "   npm install -g copilot-api"
    echo "   npx copilot-api auth"
    echo "   npx copilot-api start"
    exit 1
fi

echo ""
echo "📝 Plugin debug log:"
LOG_FILE="/tmp/opencode-smart-title-debug.log"
if [ -f "$LOG_FILE" ]; then
    echo "   tail -f $LOG_FILE"
    echo ""
    echo "Recent entries:"
    tail -n 5 "$LOG_FILE"
else
    echo "   No log file yet (plugin hasn't run)"
fi
