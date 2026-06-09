-- HoYoMusic Database Schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
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

-- Artists table — REMOVED: replaced by track_credits (credit_key='artist')
-- Kept as comment for migration reference:
-- CREATE TABLE IF NOT EXISTS artists (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    title_cn VARCHAR(500),
    title_en VARCHAR(500),
    cover_path VARCHAR(500),
    release_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    title_cn VARCHAR(500),
    title_en VARCHAR(500),
    album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
    disc_id INTEGER,
    file_path VARCHAR(500) NOT NULL,
    cover_path VARCHAR(500),
    duration INTEGER, -- in seconds
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

-- Album Discs table
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
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_tracks_disc'
    ) THEN
        ALTER TABLE tracks
        ADD CONSTRAINT fk_tracks_disc
        FOREIGN KEY (disc_id) REFERENCES album_discs(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Track Artists relationship — REMOVED: replaced by track_credits
-- CREATE TABLE IF NOT EXISTS track_artists (
--     track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
--     artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
--     PRIMARY KEY (track_id, artist_id)
-- );

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_uuid ON tracks(uuid);
CREATE INDEX IF NOT EXISTS idx_tracks_lyrics_status ON tracks(lyrics_status);
CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title);
CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_uuid ON albums(uuid);
CREATE INDEX IF NOT EXISTS idx_tracks_disc_id ON tracks(disc_id);
CREATE INDEX IF NOT EXISTS idx_album_discs_album_id ON album_discs(album_id);
CREATE INDEX IF NOT EXISTS idx_track_play_events_played_at ON track_play_events(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_track_play_events_track_effective ON track_play_events(track_id, effective_play, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_track_play_events_source_ip ON track_play_events(source_ip);

CREATE TABLE IF NOT EXISTS catalog_metadata_import_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_uuid UUID NOT NULL UNIQUE,
    requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    requested_by_username VARCHAR(100),
    sync_legacy_title BOOLEAN NOT NULL DEFAULT FALSE,
    albums_input INTEGER NOT NULL DEFAULT 0,
    tracks_input INTEGER NOT NULL DEFAULT 0,
    albums_updated INTEGER NOT NULL DEFAULT 0,
    tracks_updated INTEGER NOT NULL DEFAULT 0,
    albums_not_found INTEGER NOT NULL DEFAULT 0,
    tracks_not_found INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'rolled_back')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rolled_back_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS catalog_metadata_import_changes (
    id BIGSERIAL PRIMARY KEY,
    batch_uuid UUID NOT NULL REFERENCES catalog_metadata_import_batches(batch_uuid) ON DELETE CASCADE,
    entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('album', 'track')),
    entity_uuid UUID NOT NULL,
    entity_id INTEGER,
    before_title VARCHAR(500),
    before_title_cn VARCHAR(500),
    before_title_en VARCHAR(500),
    after_title VARCHAR(500),
    after_title_cn VARCHAR(500),
    after_title_en VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_metadata_batches_created_at ON catalog_metadata_import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_metadata_batches_status ON catalog_metadata_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_catalog_metadata_changes_batch_uuid ON catalog_metadata_import_changes(batch_uuid);
CREATE INDEX IF NOT EXISTS idx_catalog_metadata_changes_entity_uuid ON catalog_metadata_import_changes(entity_uuid);

-- Insert default admin user (password: admin123)
-- Password hash for 'admin123' with bcrypt
INSERT INTO users (username, password_hash, email_verified, is_admin)
VALUES ('admin', '$2b$10$XQqZ3zXJH4J4vF7.L0mYHOGKq5x0xVZNY9qW9z3X9X3X9X3X9X3X9e', TRUE, TRUE)
ON CONFLICT (username) DO NOTHING;
