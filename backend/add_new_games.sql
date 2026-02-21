INSERT INTO games (name, name_en, cover_path, display_order) VALUES
  ('崩坏3', 'Honkai Impact 3rd', '/games/honkai3.png', 4),
  ('未定事件簿', 'Tears of Themis', '/games/tears.jpg', 5),
  ('崩坏因缘精灵', 'Nexus', '/games/nexus.jpg', 6),
  ('星布谷地', 'Petit', '/games/petit.jpg', 7)
ON CONFLICT (name) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  cover_path = EXCLUDED.cover_path,
  display_order = EXCLUDED.display_order;
UPDATE games SET cover_path = '/games/genshin.png'  WHERE name = '原神';
UPDATE games SET cover_path = '/games/starrail.png' WHERE name = '崩坏：星穹铁道';
UPDATE games SET cover_path = '/games/zzz.png'      WHERE name = '绝区零';
SELECT id, name, name_en, cover_path, display_order FROM games ORDER BY display_order;