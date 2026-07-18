#!/bin/bash
# 将已构建的 AutoPlotter.app 打包为 DMG 安装包（Apple Silicon）。
# 用法：bash scripts/make-dmg.sh
# 说明：本脚本不使用 AppleScript/Finder 自动化（无头终端会超时），
# 只生成标准只读 DMG，内含 AutoPlotter.app 与 Applications 快捷方式。

set -euo pipefail

cd "$(dirname "$0")/.."

APP_PATH="src-tauri/target/release/bundle/macos/AutoPlotter.app"
OUT_DIR="src-tauri/target/release/bundle/dmg"
DMG_PATH="$OUT_DIR/AutoPlotter_1.0.1_aarch64.dmg"
STAGE="$OUT_DIR/dmg-staging"

if [ ! -d "$APP_PATH" ]; then
  echo "错误：未找到 $APP_PATH，请先运行 npm run tauri:build"
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "拷贝应用..."
ditto "$APP_PATH" "$STAGE/AutoPlotter.app"

echo "创建 Applications 快捷方式..."
ln -s /Applications "$STAGE/Applications"

if [ -f src-tauri/icons/icon.icns ]; then
  cp src-tauri/icons/icon.icns "$STAGE/.VolumeIcon.icns" || true
fi

echo "生成 DMG..."
rm -f "$DMG_PATH"
hdiutil create \
  -volname "AutoPlotter" \
  -srcfolder "$STAGE" \
  -ov \
  -format UDZO \
  -fs HFS+ \
  -imagekey zlib-level=9 \
  "$DMG_PATH"

rm -rf "$STAGE"
echo "完成：$DMG_PATH"
hdiutil verify "$DMG_PATH" >/dev/null && echo "DMG 校验通过"
