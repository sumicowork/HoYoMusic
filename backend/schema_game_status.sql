ALTER TABLE games ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
UPDATE games SET status = 'maintenance' WHERE name IN ('原神', '崩坏：星穹铁道', '崩坏3', '未定事件簿');
UPDATE games SET status = 'unreleased' WHERE name IN ('崩坏因缘精灵', '星布谷地');