#!/usr/bin/env bash
# bin/deploy.sh — 手动调 Render API 触发部署（GitHub Auto-Deploy 的双保险）
# 用法：
#   RENDER_API_KEY=rnd_xxx RENDER_SERVICE_ID=srv-xxx ./bin/deploy.sh
# 或在 ~/.workbuddy/secrets.env 写入后 source
set -e

# 1) 加载密钥（如果未通过环境变量传入）
if [ -z "$RENDER_API_KEY" ] || [ -z "$RENDER_SERVICE_ID" ]; then
  SECRETS="$HOME/.workbuddy/secrets.env"
  if [ -f "$SECRETS" ]; then
    set -a; . "$SECRETS"; set +a
  fi
fi

if [ -z "$RENDER_API_KEY" ] || [ -z "$RENDER_SERVICE_ID" ]; then
  echo "❌ 缺少 RENDER_API_KEY 或 RENDER_SERVICE_ID"
  echo "   请在 ~/.workbuddy/secrets.env 写入（不会被 git 跟踪）："
  echo "     RENDER_API_KEY=rnd_xxxxxxxxxxxxxx"
  echo "     RENDER_SERVICE_ID=srv-xxxxxxxxxxxxxx"
  exit 1
fi

echo "🚀 触发 Render 部署：service=$RENDER_SERVICE_ID"
HTTP_CODE=$(curl -sS -o /tmp/render_deploy.json -w "%{http_code}" \
  -X POST \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys")
echo "HTTP $HTTP_CODE"
cat /tmp/render_deploy.json | head -c 400
echo ""

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "202" ]; then
  echo "✅ Render 已接收部署请求，约 1-2 分钟生效"
  echo "   查看进度：https://dashboard.render.com/web/$RENDER_SERVICE_ID"
else
  echo "❌ 失败（HTTP $HTTP_CODE）"
  exit 1
fi
