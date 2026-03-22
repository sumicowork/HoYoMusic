-- HoYoMusic Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(200),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_verification_codes (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(200) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_verification_codes(LOWER(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_verification_codes(expires_at);

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    cover_path VARCHAR(500),
    release_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
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

-- Track Artists relationship (many-to-many)
CREATE TABLE IF NOT EXISTS track_artists (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, artist_id)
);

-- Indexes for better query performance
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

-- Insert default admin user (password: admin123)
-- Password hash for 'admin123' with bcrypt
INSERT INTO users (username, password_hash)
VALUES ('admin', '$2b$10$XQqZ3zXJH4J4vF7.L0mYHOGKq5x0xVZNY9qW9z3X9X3X9X3X9X3X9e')
ON CONFLICT (username) DO NOTHING;
