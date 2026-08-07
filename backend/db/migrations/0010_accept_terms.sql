-- 0010_accept_terms.sql
-- 注册时签订服务协议（合规：《互联网跟帖评论服务管理规定》第5条① 与注册用户签订服务协议）
-- users.accept_terms_at：记录用户同意《用户协议》《隐私政策》的时间（NULL=未同意/历史账号）

ALTER TABLE users ADD COLUMN IF NOT EXISTS accept_terms_at timestamptz;
