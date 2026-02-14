#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

count_matches() {
  local pattern="$1"
  shift
  (rg -n "$pattern" "$@" || true) | wc -l | tr -d ' '
}

INDEX_INLINE_STYLE_MAX=45
APP_INLINE_STYLE_MAX=188

index_inline_styles=$(count_matches 'style="' index.html)
app_inline_styles=$(count_matches 'style="' app.js)
inline_handlers=$(count_matches 'onclick=|onchange=|oninput=|onmouseover=|onmouseout=' index.html app.js)

ui_card_defs=$(count_matches '^\.ui-card\s*\{' style.css)
ui_title_defs=$(count_matches '^\.ui-title\s*\{' style.css)
ui_btn_defs=$(count_matches '^\.ui-btn\s*\{' style.css)
ui_btn_primary_defs=$(count_matches '^\.ui-btn--primary\s*\{' style.css)
ui_btn_secondary_defs=$(count_matches '^\.ui-btn--secondary\s*\{' style.css)
ui_input_defs=$(count_matches '^\.ui-input,\s*$' style.css)
ui_empty_defs=$(count_matches '^\.ui-empty\s*\{' style.css)
ui_chip_defs=$(count_matches '^\.ui-chip\s*\{' style.css)
ui_kicker_defs=$(count_matches '^\.ui-kicker\s*\{' style.css)

root_defs=$(count_matches '^:root\s*\{' style.css)
btn_primary_defs=$(count_matches '^\.btn-primary\s*\{' style.css)
command_dock_pill_defs=$(count_matches '^\.command-dock-pill\s*\{' style.css)

failed=0

if (( index_inline_styles > INDEX_INLINE_STYLE_MAX )); then
  echo "FAIL: index.html inline styles = ${index_inline_styles} (max ${INDEX_INLINE_STYLE_MAX})"
  failed=1
fi

if (( app_inline_styles > APP_INLINE_STYLE_MAX )); then
  echo "FAIL: app.js inline styles = ${app_inline_styles} (max ${APP_INLINE_STYLE_MAX})"
  failed=1
fi

if (( inline_handlers != 0 )); then
  echo "FAIL: inline event handlers found in index.html/app.js (${inline_handlers})"
  failed=1
fi

if (( root_defs != 1 )); then
  echo "FAIL: :root must be defined once in style.css (found ${root_defs})"
  failed=1
fi

if (( btn_primary_defs != 1 )); then
  echo "FAIL: .btn-primary must be defined once in style.css (found ${btn_primary_defs})"
  failed=1
fi

if (( command_dock_pill_defs != 1 )); then
  echo "FAIL: .command-dock-pill must be defined once in style.css (found ${command_dock_pill_defs})"
  failed=1
fi

if (( ui_card_defs != 1 || ui_title_defs != 1 || ui_btn_defs != 1 || ui_btn_primary_defs != 1 || ui_btn_secondary_defs != 1 || ui_input_defs != 1 || ui_empty_defs != 1 || ui_chip_defs != 1 || ui_kicker_defs != 1 )); then
  echo "FAIL: canonical .ui-* primitive selectors must each be defined exactly once"
  echo "  ui-card=${ui_card_defs} ui-title=${ui_title_defs} ui-btn=${ui_btn_defs} ui-btn--primary=${ui_btn_primary_defs} ui-btn--secondary=${ui_btn_secondary_defs} ui-input=${ui_input_defs} ui-empty=${ui_empty_defs} ui-chip=${ui_chip_defs} ui-kicker=${ui_kicker_defs}"
  failed=1
fi

if (( failed != 0 )); then
  exit 1
fi

echo "PASS: UI consistency checks"
echo "  index inline styles: ${index_inline_styles}/${INDEX_INLINE_STYLE_MAX}"
echo "  app inline styles: ${app_inline_styles}/${APP_INLINE_STYLE_MAX}"
echo "  inline handlers: ${inline_handlers}"
