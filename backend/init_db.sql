-- ============================================================
-- HoYoMusic 数据库完整初始化脚本
-- 按依赖顺序合并所有 schema 文件，一次执行即可
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. 基础表（schema.sql）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(200),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    account_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'disabled')),
    status_reason VARCHAR(500),
    token_version INTEGER NOT NULL DEFAULT 0,
    password_hash VARCHAR(255) NOT NULL,
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status);

CREATE TABLE IF NOT EXISTS auth_verification_codes (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(200) NOT NULL,
    challenge_id UUID,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_challenge ON auth_verification_codes(challenge_id);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_verification_codes(LOWER(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_verification_codes(expires_at);

CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    cover_path VARCHAR(500),
    release_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
    disc_id INTEGER,
    file_path VARCHAR(500) NOT NULL,
    cover_path VARCHAR(500),
    duration INTEGER,
    track_number INTEGER,
    sample_rate INTEGER,
    bit_depth INTEGER,
    file_size BIGINT,
    play_count INTEGER DEFAULT 0,
    lyrics_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (lyrics_status IN ('none', 'has', 'instrumental')),
    release_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS track_play_events (
    id BIGSERIAL PRIMARY KEY,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    played_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
    track_duration_seconds NUMERIC(10,2),
    min_required_seconds NUMERIC(10,2) NOT NULL,
    effective_play BOOLEAN NOT NULL DEFAULT FALSE,
    source_ip VARCHAR(64),
    user_agent TEXT,
    session_key VARCHAR(128) NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (track_id, session_key)
);

CREATE TABLE IF NOT EXISTS album_discs (
    id SERIAL PRIMARY KEY,
    album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    disc_number INTEGER NOT NULL,
    disc_title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (album_id, disc_number)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tracks_disc'
    ) THEN
        ALTER TABLE tracks
        ADD CONSTRAINT fk_tracks_disc
        FOREIGN KEY (disc_id) REFERENCES album_discs(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS track_artists (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title);
CREATE INDEX IF NOT EXISTS idx_track_artists_track_id ON track_artists(track_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist_id ON track_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_disc_id ON tracks(disc_id);
CREATE INDEX IF NOT EXISTS idx_album_discs_album_id ON album_discs(album_id);
CREATE INDEX IF NOT EXISTS idx_track_play_events_played_at ON track_play_events(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_track_play_events_track_effective ON track_play_events(track_id, effective_play, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_track_play_events_source_ip ON track_play_events(source_ip);

-- 默认管理员（密码：admin123，请登录后立即修改）
INSERT INTO users (username, password_hash, email_verified, is_admin)
VALUES ('admin', '$2b$10$XQqZ3zXJH4J4vF7.L0mYHOGKq5x0xVZNY9qW9z3X9X3X9X3X9X3X9e', TRUE, TRUE)
ON CONFLICT (username) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. 游戏分类（schema_game_categories.sql）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    name_en VARCHAR(100),
    description TEXT,
    cover_path VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE albums ADD COLUMN IF NOT EXISTS game_id INTEGER REFERENCES games(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_albums_game_id ON albums(game_id);

INSERT INTO games (name, name_en, display_order) VALUES
    ('原神',           'Genshin Impact',    1),
    ('崩坏：星穹铁道', 'Honkai: Star Rail', 2),
    ('绝区零',         'Zenless Zone Zero', 3)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON games
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 3. Credits（schema_phase2_credits.sql）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS track_credits (
    id SERIAL PRIMARY KEY,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    credit_key VARCHAR(100) NOT NULL,
    credit_value TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_track_credits_track_id ON track_credits(track_id);
CREATE INDEX IF NOT EXISTS idx_track_credits_order ON track_credits(track_id, display_order);

-- ────────────────────────────────────────────────────────────
-- 4. 歌词（schema_phase2_lyrics.sql）
-- ────────────────────────────────────────────────────────────

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lyrics_path VARCHAR(500);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lyrics_status VARCHAR(20);

UPDATE tracks
SET lyrics_status = CASE
  WHEN lyrics_path IS NOT NULL AND BTRIM(lyrics_path) <> '' THEN 'has'
  ELSE 'none'
END
WHERE lyrics_status IS NULL OR BTRIM(lyrics_status) = '';

ALTER TABLE tracks ALTER COLUMN lyrics_status SET DEFAULT 'none';
ALTER TABLE tracks ALTER COLUMN lyrics_status SET NOT NULL;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS chk_tracks_lyrics_status;
ALTER TABLE tracks
ADD CONSTRAINT chk_tracks_lyrics_status
CHECK (lyrics_status IN ('none', 'has', 'instrumental'));

CREATE INDEX IF NOT EXISTS idx_tracks_lyrics ON tracks(lyrics_path) WHERE lyrics_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_lyrics_status ON tracks(lyrics_status);

-- ────────────────────────────────────────────────────────────
-- 5. 标签基础表（schema_tags.sql）—— 必须在 enhanced 之前
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#1890ff',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS track_tags (
    id SERIAL PRIMARY KEY,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(track_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_track_tags_track_id ON track_tags(track_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag_id ON track_tags(tag_id);

CREATE OR REPLACE FUNCTION update_tag_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tag_timestamp ON tags;
CREATE TRIGGER trigger_update_tag_timestamp
BEFORE UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION update_tag_timestamp();

COMMENT ON TABLE tags IS 'Music tags for categorization';
COMMENT ON TABLE track_tags IS 'Track and tag association';
COMMENT ON COLUMN tags.color IS 'Tag display color in hex format';

-- ────────────────────────────────────────────────────────────
-- 6. 标签分组扩展（schema_tags_enhanced_utf8.sql）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tag_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tags
ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES tag_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_tags_group_id ON tags(group_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tag_groups_name ON tag_groups(name);

CREATE OR REPLACE FUNCTION update_tag_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tag_group_timestamp ON tag_groups;
CREATE TRIGGER trigger_update_tag_group_timestamp
BEFORE UPDATE ON tag_groups
FOR EACH ROW EXECUTE FUNCTION update_tag_group_timestamp();

INSERT INTO tag_groups (name, description, icon, display_order) VALUES
    ('游戏分类', '按游戏系列分类的标签', 'GamepadOutlined',   1),
    ('音乐风格', '音乐风格和类型标签',   'SoundOutlined',     2),
    ('语言',     '歌曲语言标签',         'GlobalOutlined',    3),
    ('情感',     '音乐情感和氛围标签',   'HeartOutlined',     4),
    ('场景',     '适用场景标签',         'EnvironmentOutlined', 5),
    ('其他',     '其他分类标签',         'TagsOutlined',      99)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE tag_groups IS 'Tag groups for organizing tags';
COMMENT ON COLUMN tags.group_id IS 'Tag group reference';
COMMENT ON COLUMN tags.parent_id IS 'Parent tag reference for hierarchical structure';
COMMENT ON COLUMN tags.display_order IS 'Display order within group or parent';
COMMENT ON COLUMN tag_groups.display_order IS 'Group display order';

CREATE OR REPLACE FUNCTION get_tag_path(tag_id INTEGER)
RETURNS TEXT AS $$
DECLARE
    path TEXT := '';
    current_id INTEGER := tag_id;
    current_name VARCHAR(50);
    parent INTEGER;
BEGIN
    LOOP
        SELECT name, tags.parent_id INTO current_name, parent
        FROM tags WHERE id = current_id;

        IF current_name IS NULL THEN EXIT; END IF;

        IF path = '' THEN
            path := current_name;
        ELSE
            path := current_name || ' > ' || path;
        END IF;

        IF parent IS NULL THEN EXIT; END IF;

        current_id := parent;
    END LOOP;
    RETURN path;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tag_path IS 'Get full hierarchical path of a tag';

-- ────────────────────────────────────────────────────────────
-- 7. 追加游戏数据（add_new_games.sql）
-- ────────────────────────────────────────────────────────────

INSERT INTO games (name, name_en, cover_path, display_order) VALUES
    ('崩坏3',       'Honkai Impact 3rd', '/games/honkai3.png', 4),
    ('未定事件簿',   'Tears of Themis',   '/games/tears.jpg',  5),
    ('崩坏因缘精灵', 'Nexus',             '/games/nexus.jpg',  6),
    ('星布谷地',     'Petit',             '/games/petit.jpg',  7)
ON CONFLICT (name) DO UPDATE SET
    name_en       = EXCLUDED.name_en,
    cover_path    = EXCLUDED.cover_path,
    display_order = EXCLUDED.display_order;

UPDATE games SET cover_path = '/games/genshin.png'  WHERE name = '原神';
UPDATE games SET cover_path = '/games/starrail.png' WHERE name = '崩坏：星穹铁道';
UPDATE games SET cover_path = '/games/zzz.png'      WHERE name = '绝区零';

-- ────────────────────────────────────────────────────────────
-- 完成验证
-- ────────────────────────────────────────────────────────────
SELECT '✅ 数据库初始化完成' AS status;
SELECT id, name, name_en, cover_path, display_order FROM games ORDER BY display_order;
SELECT id, name, icon, display_order FROM tag_groups ORDER BY display_order;

