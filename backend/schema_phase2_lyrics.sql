-- Phase 2: Add lyrics support

-- Add lyrics_path column to tracks table
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lyrics_path VARCHAR(500);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tracks_lyrics ON tracks(lyrics_path) WHERE lyrics_path IS NOT NULL;

