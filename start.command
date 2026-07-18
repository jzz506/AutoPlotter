#!/bin/bash
# AutoPlotter 启动脚本
# 双击此文件即可启动应用（macOS）
# 不需要 sudo，不会上传任何数据。

set -u

cd "$(dirname "$0")" || {
  echo "错误：无法进入项目目录。"
  read -r -p "按回车键退出..."
  exit 1
}

echo "=============================="
echo "  AutoPlotter 启动程序"
echo "  数据仅在本地浏览器中处理"
echo "=============================="
echo ""

find_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "$HOME/.volta/bin/node" \
    "$HOME/.fnm/aliases/default/bin/node"; do
    if [ -x "$candidate" ]; then
      export PATH="$(dirname "$candidate"):$PATH"
      return 0
    fi
  done
  if [ -d "$HOME/.nvm/versions/node" ]; then
    local latest
    latest=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)
    if [ -n "$latest" ] && [ -x "$HOME/.nvm/versions/node/$latest/bin/node" ]; then
      export PATH="$HOME/.nvm/versions/node/$latest/bin:$PATH"
      return 0
    fi
  fi
  return 1
}

if ! find_node; then
  echo "错误：未找到 Node.js。"
  echo "请先安装 Node.js（建议 20 或更高版本）："
  echo "  1. 访问 https://nodejs.org 下载安装包；或"
  echo "  2. 使用 Homebrew：brew install node"
  read -r -p "按回车键退出..."
  exit 1
fi

echo "Node.js 版本：$(node --version)"
echo "npm 版本：$(npm --version)"
echo ""

if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo "正在安装项目依赖（仅首次或依赖变更时需要）..."
  if ! npm install; then
    echo ""
    echo "错误：依赖安装失败。请检查网络连接后重试。"
    read -r -p "按回车键退出..."
    exit 1
  fi
else
  echo "依赖已就绪，跳过安装。"
fi

PORT=5173
URL="http://localhost:$PORT/"

echo ""
echo "正在启动 AutoPlotter ..."
echo "地址：$URL"
echo "关闭此窗口即可停止应用。"
echo ""

( sleep 3 && open "$URL" ) &

if ! npm run dev -- --port "$PORT" --strictPort; then
  echo ""
  echo "错误：应用启动失败。可能是端口 $PORT 被占用。"
  echo "请关闭占用该端口的程序后重试。"
  read -r -p "按回车键退出..."
  exit 1
fi
