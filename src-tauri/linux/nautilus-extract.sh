#!/usr/bin/env bash
# ZipTag — Nautilus context menu script: Extract (GNOME)
#
# Installation:
#   mkdir -p ~/.local/share/nautilus/scripts
#   cp this-file ~/.local/share/nautilus/scripts/"Extract with ZipTag"
#   chmod +x ~/.local/share/nautilus/scripts/"Extract with ZipTag"
#   nautilus -q

ZIPTAG_BIN="ziptag"
if ! command -v "$ZIPTAG_BIN" &>/dev/null; then
  ZIPTAG_BIN="$HOME/.local/bin/ziptag"
fi

# Take only the first selected archive for extraction.
ARCHIVE=$(echo "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS" | head -n 1)
[[ -z "$ARCHIVE" ]] && exit 0

exec "$ZIPTAG_BIN" --quick-extract "$ARCHIVE"
