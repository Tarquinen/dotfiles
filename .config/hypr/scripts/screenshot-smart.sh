#!/bin/bash

get_rectangles() {
  # Get all monitors
  hyprctl monitors -j | jq -r '.[] | "\(.x),\(.y) \((.width / .scale) | floor)x\((.height / .scale) | floor)"'
  
  # Get all visible workspaces (one per monitor)
  local visible_workspaces=$(hyprctl monitors -j | jq -r '.[].activeWorkspace.id')
  
  # Get windows from all visible workspaces
  hyprctl clients -j | jq -r --argjson workspaces "[$(echo "$visible_workspaces" | tr '\n' ',' | sed 's/,$//')]" '.[] | select([.workspace.id] | inside($workspaces)) | "\(.at[0]),\(.at[1]) \(.size[0])x\(.size[1])"'
}

[[ -f ~/.config/user-dirs.dirs ]] && source ~/.config/user-dirs.dirs
BASE_DIR="${XDG_PICTURES_DIR:-$HOME/Pictures}"

pkill slurp && exit 0

wayfreeze & PID=$!
sleep .1
SELECTION=$(get_rectangles | slurp 2>/dev/null)
kill $PID 2>/dev/null

[ -z "$SELECTION" ] && exit 0

YEAR=$(date +'%Y')
MONTH=$(date +'%m')
OUTPUT_DIR="$BASE_DIR/$YEAR/$MONTH"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/screenshot-$(date +'%Y-%m-%d_%H-%M-%S').png"
grim -g "$SELECTION" "$OUTPUT_FILE" && wl-copy < "$OUTPUT_FILE" && notify-send "Screenshot saved and copied" "$OUTPUT_FILE" -t 2000
