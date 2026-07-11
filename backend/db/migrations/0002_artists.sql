-- Migration 0002: introduce a real `artists` entity table.
-- Creators were previously virtual (aggregated from track_credits.credit_value
-- strings at query time). This gives them stable numeric ids, enables
-- de-duplication via artist_aliases, and lets the public artist endpoints serve
-- consolidated, cacheable pages instead of recomputing heavy CTEs on every call.
--
-- Pure additive: only ONE new table + one nullable column on track_credits.
-- No existing data is dropped or altered in place.

-- 1. Artists entity table (first-class creator records)
CREATE TABLE IF NOT EXISTS public.artists (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(500) NOT NULL,
  slug        VARCHAR(600) UNIQUE,
  bio         TEXT,
  avatar_path VARCHAR(500),
  type        VARCHAR(50) DEFAULT 'person',
  created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artists_name ON public.artists (name);
CREATE INDEX IF NOT EXISTS idx_artists_slug ON public.artists (slug);

-- 2. Link each credit row to a canonical artist (filled by backfill script)
ALTER TABLE public.track_credits ADD COLUMN IF NOT EXISTS artist_id INTEGER;

ALTER TABLE public.track_credits
  DROP CONSTRAINT IF EXISTS fk_track_credits_artist;

ALTER TABLE public.track_credits
  ADD CONSTRAINT fk_track_credits_artist
  FOREIGN KEY (artist_id) REFERENCES public.artists (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_track_credits_artist_id ON public.track_credits (artist_id);
