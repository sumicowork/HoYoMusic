-- Migration 0008: credit_role_norm 双轨制
-- 规范职务名列（用户可见功能用规范名；credit_key 保留原文供审计/溯源）

ALTER TABLE track_credits ADD COLUMN IF NOT EXISTS credit_role_norm varchar(100);

-- 职务规范映射源（原文 → 规范中文；规范调整只改此表，不重跑 AI）
CREATE TABLE IF NOT EXISTS credit_role_map (
  role_key varchar(200) PRIMARY KEY,
  role_norm varchar(100) NOT NULL,
  role_en varchar(200),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);
