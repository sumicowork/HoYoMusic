#!/bin/bash
# ============================================================
# HoYoMusic 增量更新部署脚本
# 适用于本次 8-issue 功能更新
# 在服务器 1Panel 终端中执行：bash /opt/HoYoMusic/scripts/deploy-update.sh
# ============================================================
set -e

APP_DIR="/opt/HoYoMusic"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
CONTAINER_NAME="hoyomusic-api"
# 修改为你实际的 PostgreSQL 容器名和数据库信息
PG_CONTAINER="1panel-postgresql"
PG_USER="hoyomusic_user"
PG_DB="hoyomusic"

echo ""
echo "========================================"
echo " HoYoMusic 增量更新部署"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# ── Step 1: 拉取最新代码 ──────────────────────────────────────
echo ""
echo "[1/5] 拉取最新代码..."
cd "$APP_DIR"
git pull origin main
echo "✅ 代码已更新"

# ── Step 2: 执行数据库迁移（新增 artist_aliases 表）─────────────
echo ""
echo "[2/5] 执行数据库迁移（创建 artist_aliases 表）..."
docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" \
  < "$BACKEND_DIR/schema_artist_aliases.sql" && echo "✅ 数据库迁移完成" || {
    echo "⚠️  数据库迁移执行出错（若表已存在可忽略）"
}

# ── Step 3: 安装后端新依赖（sharp）──────────────────────────────
echo ""
echo "[3/5] 安装后端依赖（含新增 sharp 图片处理库）..."
cd "$BACKEND_DIR"

# 判断是否在容器内运行，还是宿主机
if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  echo "  → 在容器 $CONTAINER_NAME 内安装依赖并重新构建..."
  docker exec "$CONTAINER_NAME" bash -c "cd /opt/HoYoMusic/backend && npm install && npm run build"
  echo "✅ 后端依赖安装完成（容器内）"
else
  echo "  → 在宿主机安装依赖..."
  npm install
  npm run build
  echo "✅ 后端依赖安装完成（宿主机）"
fi

# ── Step 4: 构建前端 ──────────────────────────────────────────
echo ""
echo "[4/5] 构建前端..."
cd "$FRONTEND_DIR"
npm install
npm run build
echo "✅ 前端构建完成，产物在 $FRONTEND_DIR/dist/"

# ── Step 5: 重启后端容器 ──────────────────────────────────────
echo ""
echo "[5/5] 重启后端服务..."
if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  docker restart "$CONTAINER_NAME"
  echo "✅ 容器 $CONTAINER_NAME 已重启"
  sleep 3
  # 健康检查
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 后端健康检查通过 (HTTP 200)"
  else
    echo "⚠️  后端健康检查返回 $HTTP_CODE，请查看容器日志："
    echo "   docker logs $CONTAINER_NAME --tail 50"
  fi
else
  echo "⚠️  未找到容器 $CONTAINER_NAME，请在 1Panel 面板手动重启运行环境"
fi

echo ""
echo "========================================"
echo " 部署完成！"
echo "========================================"
echo ""
echo "📋 验证清单："
echo "  1. 浏览器访问 /api/health → 应返回 {\"success\":true}"
echo "  2. 后台管理 /admin → 曲目管理含搜索框"
echo "  3. 后台管理 /admin/albums → 专辑含「批量设置游戏」和「重读日期」"
echo "  4. 后台管理 /admin/artists → 新艺术家管理页"
echo "  5. 公开搜索页 /search → 筛选器改为游戏/艺术家维度"
echo "  6. 艺术家详情页 → 头部显示参与游戏小图标"
echo "  7. 封面图片缩略图（首次加载变快）"
echo ""

