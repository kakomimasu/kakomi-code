#!/usr/bin/env bash
# macOS / Linux: このファイルをダブルクリック、または ./run.sh で実行します。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v deno >/dev/null 2>&1; then
  echo "Deno が見つかりません。https://deno.com/ からインストールしてから、もう一度実行してください。" >&2
  exit 1
fi

echo "囲みコードをビルドして起動します…"
TASK_NAME="desktop"
if [[ "${OSTYPE:-}" == darwin* ]]; then
  TASK_NAME="desktop:mac"
fi

if [[ -f ".env" ]]; then
  deno task --env-file=.env "$TASK_NAME"
else
  deno task "$TASK_NAME"
fi

if [[ "${OSTYPE:-}" == darwin* ]] && [[ -d "Kakomimasu.app" ]]; then
  INFO_PLIST="Kakomimasu.app/Contents/Info.plist"
  for KEY in CFBundleDisplayName CFBundleName; do
    /usr/bin/plutil -replace "$KEY" -string "囲みコード" "$INFO_PLIST" 2>/dev/null || \
      /usr/bin/plutil -insert "$KEY" -string "囲みコード" "$INFO_PLIST"
  done
  open "Kakomimasu.app"
elif [[ -x "Kakomimasu/Kakomimasu" ]]; then
  ./Kakomimasu/Kakomimasu >/dev/null 2>&1 &
elif [[ -x "app" ]]; then
  ./app >/dev/null 2>&1 &
else
  echo "Desktopアプリが見つかりませんでした。" >&2
  exit 1
fi
