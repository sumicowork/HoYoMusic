-- Artist Avatars Schema
-- Stores avatar image paths keyed by artist name (since artists are virtual entities from track_credits)

CREATE TABLE IF NOT EXISTS artist_avatars (
  id SERIAL PRIMARY KEY,
  artist_name VARCHAR(500) NOT NULL UNIQUE,
  avatar_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artist_avatars_name ON artist_avatars(artist_name);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_artist_avatar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artist_avatar_timestamp ON artist_avatars;
CREATE TRIGGER trigger_update_artist_avatar_timestamp
BEFORE UPDATE ON artist_avatars
FOR EACH ROW
EXECUTE FUNCTION update_artist_avatar_timestamp();

COMMENT ON TABLE artist_avatars IS 'Avatar images for artists (keyed by name since artists are virtual)';

