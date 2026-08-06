-- 0009_comments_ratings.sql
-- 评论 + 打分 + 举报 + 手机号实名（合规：《互联网跟帖评论服务管理规定》2022）
-- 后台实名：users.phone 绑定；日志留存：comments 带 ip/ua + 软删（不物理删，≥6个月）

-- 1. users 手机号实名
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uq ON users (phone) WHERE phone IS NOT NULL;

-- 2. auth_verification_codes 支持手机号验证（email 可为空）
ALTER TABLE auth_verification_codes ADD COLUMN IF NOT EXISTS phone varchar(20);
ALTER TABLE auth_verification_codes ALTER COLUMN email DROP NOT NULL;
CREATE INDEX IF NOT EXISTS avc_phone_idx ON auth_verification_codes (phone);

-- 3. comments 评论表（target: track/album/game/artist）
CREATE TABLE IF NOT EXISTS comments (
    id bigserial PRIMARY KEY,
    target_type varchar(20) NOT NULL CHECK (target_type IN ('track', 'album', 'game', 'artist')),
    target_id integer NOT NULL,
    user_id integer NOT NULL REFERENCES users(id),
    content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    ip varchar(64),
    user_agent varchar(500),
    report_count integer NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_target_idx ON comments (target_type, target_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_user_idx ON comments (user_id);

-- 4. ratings 评分表（1-5 星，UNIQUE 防刷）
CREATE TABLE IF NOT EXISTS ratings (
    id bigserial PRIMARY KEY,
    target_type varchar(20) NOT NULL CHECK (target_type IN ('track', 'album', 'game', 'artist')),
    target_id integer NOT NULL,
    user_id integer NOT NULL REFERENCES users(id),
    score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ratings_target_user_uq UNIQUE (target_type, target_id, user_id)
);
CREATE INDEX IF NOT EXISTS ratings_target_idx ON ratings (target_type, target_id);

-- 5. reports 举报表（跟帖规定：举报受理制度）
CREATE TABLE IF NOT EXISTS reports (
    id bigserial PRIMARY KEY,
    comment_id bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    reporter_id integer NOT NULL REFERENCES users(id),
    reason varchar(100) NOT NULL,
    detail varchar(500),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'handled', 'ignored')),
    created_at timestamptz NOT NULL DEFAULT now(),
    handled_at timestamptz,
    handler_id integer REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at);
