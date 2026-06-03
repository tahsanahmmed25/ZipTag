#!/usr/bin/env bash
# ZipTag — Nautilus context menu script (GNOME)
#
# Installation:
#   mkdir -p ~/.local/share/nautilus/scripts
#   cp this-file ~/.local/share/nautilus/scripts/"Compress with ZipTag"
#   chmod +x ~/.local/share/nautilus/scripts/"Compress with ZipTag"
#   nautilus -q   # restart Nautilus to pick up the new script
#
# ZipTag must be installed and available on $PATH or at the absolute path below.
# Adjust ZIPTAG_BIN if installed to a non-standard location.

ZIPTAG_BIN="ziptag"
if ! command -v "$ZIPTAG_BIN" &>/dev/null; then
  # Fallback: common AppImage / installed path
  ZIPTAG_BIN="$HOME/.local/bin/ziptag"
fi

# NAUTILUS_SCRIPT_SELECTED_FILE_PATHS contains newline-separated absolute paths.
# Build the argument list.
args=()
while IFS= read -r path; do
  [[ -n "$path" ]] && args+=("$path")
done <<< "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS"

if [[ ${#args[@]} -eq 0 ]]; then
  exit 0
fi

exec "$ZIPTAG_BIN" --quick-compress "${args[@]}"
