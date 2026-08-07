-- 0012_comment_audit.sql
-- 评论审核/删除操作留痕（监管协查：谁审核、何时审核、谁删除）
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reviewed_by integer REFERENCES users(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_by integer REFERENCES users(id);
