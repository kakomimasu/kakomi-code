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
ENV_ARGS=()
if [[ -f ".env" ]]; then
  ENV_ARGS=(--env-file=.env)
fi
if [[ "${OSTYPE:-}" == darwin* ]]; then
  deno task "${ENV_ARGS[@]}" desktop:mac
else
  deno task "${ENV_ARGS[@]}" desktop
fi

if [[ "${OSTYPE:-}" == darwin* ]] && [[ -d "Kakomimasu.app" ]]; then
  INFO_PLIST="Kakomimasu.app/Contents/Info.plist"
  for KEY in CFBundleDisplayName CFBundleName; do
    /usr/bin/plutil -replace "$KEY" -string "囲みコード" "$INFO_PLIST" 2>/dev/null || \
      /usr/bin/plutil -insert "$KEY" -string "囲みコード" "$INFO_PLIST"
  done
  open "Kakomimasu.app"
elif [[ -x "app" ]]; then
  ./app >/dev/null 2>&1 &
else
  echo "Desktopアプリが見つかりませんでした。" >&2
  exit 1
fi
