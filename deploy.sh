#!/usr/bin/env bash
# 部署到 VPS
# 用法: ./deploy.sh user@host

set -e

HOST="${1:?用法: ./deploy.sh user@host}"
REMOTE_DIR="/var/www/hansen-web"
LOCAL_OUT="out"

# 1. 本地构建
echo "→ 构建中..."
npm run build

# 2. 上传 out/ 到服务器（先到临时目录再原子替换，避免读到不完整文件）
echo "→ 上传到 $HOST..."
ssh "$HOST" "mkdir -p $REMOTE_DIR.tmp"
rsync -avz --delete "$LOCAL_OUT/" "$HOST:$REMOTE_DIR.tmp/"
ssh "$HOST" "rm -rf $REMOTE_DIR && mv $REMOTE_DIR.tmp $REMOTE_DIR"

echo "✓ 部署完成 → http://$HOST"
