-- 0004_track_source_note.sql
--
-- Store a per-(track, source) condition/affix annotation next to each edge.
-- During music-source normalization we strip condition suffixes from location
-- paths (e.g. "Qingyun Peak / night; rain", "Dragonspine / all times; near
-- Cryo Hypostasis") so the geographic tree stays clean. The stripped affix is
-- kept here as a small footnote shown beside the track on its source page
-- (user-confirmed design: "保留主名，前后缀作为小字说明放在曲子旁边").
--
-- Purely additive: no column drop, no data deletion. Safe to re-run.

ALTER TABLE public.track_music_sources
  ADD COLUMN IF NOT EXISTS note text;

-- Speed up any future "show all annotated edges" queries.
CREATE INDEX IF NOT EXISTS idx_track_music_sources_note
  ON public.track_music_sources (note) WHERE note IS NOT NULL;
