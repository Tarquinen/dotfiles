#!/bin/bash
# Helper script to watch plugin logs in real time

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PLUGIN_DIR/logs"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

echo "Dynamic Context Pruning - Log Viewer"
echo "===================================="
echo ""

# Check if debug is enabled
if grep -q "debug: false" "$PLUGIN_DIR/lib/config.ts"; then
    echo "⚠️  WARNING: Debug logging is DISABLED"
    echo "   Edit lib/config.ts and set 'debug: true' to enable logging"
    echo ""
    exit 1
fi

echo "✓ Debug logging is enabled"
echo ""

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo "ℹ️  Log file not found: $LOG_FILE"
    echo ""
    echo "   This means OpenCode hasn't been restarted since the plugin was updated."
    echo ""
    echo "   To generate logs:"
    echo "   1. Restart OpenCode to reload the plugin"
    echo "   2. Logs will be created automatically"
    echo ""
    echo "   Waiting for log file to appear..."
    echo "   (Press Ctrl+C to cancel)"
    echo ""
    
    # Wait for file to be created
    while [ ! -f "$LOG_FILE" ]; do
        sleep 2
    done
    
    echo "✓ Log file created!"
    echo ""
fi

echo "📺 Watching: $LOG_FILE"
echo "   Press Ctrl+C to stop"
echo ""
echo "----------------------------------------"
echo ""

# Show all logs with pretty printing if jq is available
if command -v jq &> /dev/null; then
    tail -f "$LOG_FILE" | jq --color-output '.'
else
    tail -f "$LOG_FILE"
fi

