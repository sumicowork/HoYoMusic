-- 更新游戏封面路径
UPDATE games SET cover_path = '/games/genshin.png' WHERE name = '原神';
UPDATE games SET cover_path = '/games/starrail.png' WHERE name = '崩坏：星穹铁道';
UPDATE games SET cover_path = '/games/zzz.png' WHERE name = '绝区零';

-- 验证更新
SELECT id, name, cover_path FROM games ORDER BY display_order;

