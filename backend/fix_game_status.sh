#!/bin/bash
# 修复 games 表 status 字段
# 用法：bash fix_game_status.sh [容器名]
# 默认容器名为 1panel-postgresql

CONTAINER=${1:-1panel-postgresql}

echo "=== 使用容器: $CONTAINER ==="

docker exec -i "$CONTAINER" psql -U hoyomusic_user -d hoyomusic << 'EOF'
ALTER TABLE games ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

UPDATE games SET status = 'maintenance' WHERE name IN ('原神', '崩坏：星穹铁道', '崩坏3', '未定事件簿');

UPDATE games SET status = 'unreleased' WHERE name IN ('崩坏因缘精灵', '星布谷地');

SELECT id, name, status FROM games ORDER BY display_order;
EOF

echo "=== 完成 ==="
