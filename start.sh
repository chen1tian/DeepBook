#!/bin/bash
set -e

echo "=== DeepBook 部署脚本 ==="

# 1. 拉取最新代码
echo "[1/3] 拉取最新代码..."
git pull

# 2. 安装依赖（如有变更）
echo "[2/3] 安装依赖..."
npm install

# 3. 构建
echo "[3/3] 构建项目..."
npx next build --webpack

# 4. 启动
echo "=== 构建完成，启动服务 ==="
npx next start
