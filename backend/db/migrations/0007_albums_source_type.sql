-- 0007_albums_source_type.sql — 专辑来源标识（迁移 0007）
-- NORMAL=常规专辑（参与自动匹配）；EXTRA=外部提取（需人工关联，不参与任何自动匹配）
ALTER TABLE albums ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'NORMAL';
ALTER TABLE albums DROP CONSTRAINT IF EXISTS albums_source_type_check;
ALTER TABLE albums ADD CONSTRAINT albums_source_type_check CHECK (source_type IN ('NORMAL', 'EXTRA'));
