-- 0015_user_deletion.sql
-- 账号注销支持（P0-2 体检修复：协议承诺的注销流程落地）
-- deleted_at 记录注销时间；account_status 扩展 'deleted' 状态（登录被拒，passport 校验）

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active', 'disabled', 'deleted'));
