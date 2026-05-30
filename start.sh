#!/bin/bash
set -e

echo "=== DeepBook 部署脚本 ==="

BUILD_MARKER=".last-build-commit"

# 1. 拉取最新代码
echo "[1/3] 拉取最新代码..."
git pull

# 获取当前 HEAD commit hash
CURRENT_COMMIT=$(git rev-parse HEAD)
# 结合 package.json 的 hash，确保依赖变更也能触发重建
PKG_HASH=$(sha256sum package.json 2>/dev/null | cut -d' ' -f1 || md5sum package.json 2>/dev/null | cut -d' ' -f1)
CURRENT_MARKER="${CURRENT_COMMIT}-${PKG_HASH}"

# 2. 安装依赖
echo "[2/3] 安装依赖..."
npm install

# 3. 构建（如果代码未变化且上次构建成功则跳过）
LAST_BUILD=$(cat "$BUILD_MARKER" 2>/dev/null || echo "")

if [ "$CURRENT_MARKER" = "$LAST_BUILD" ] && [ -d ".next" ]; then
  echo "[3/3] 代码未变更，跳过构建。"
else
  echo "[3/3] 构建项目..."
  npx next build --webpack
  # 构建成功后记录本次标记
  echo "$CURRENT_MARKER" > "$BUILD_MARKER"
fi

# 4. 启动
echo "=== 启动服务 ==="
npx next start
