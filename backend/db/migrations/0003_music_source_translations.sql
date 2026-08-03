-- 0003_music_source_translations.sql
--
-- Track the English source name + translation status on the music-source tree
-- so we can persist fandom-derived Chinese names while ALWAYS keeping the
-- source English and marking untranslated nodes as `pending` (never guess).
--
-- Purely additive: no column drop, no data deletion. Safe to re-run
-- (ADD COLUMN IF NOT EXISTS / DEFAULT).

ALTER TABLE public.music_source_nodes
  ADD COLUMN IF NOT EXISTS en_name character varying(200),
  ADD COLUMN IF NOT EXISTS translation_status character varying(20) NOT NULL DEFAULT 'pending';

ALTER TABLE public.music_source_categories
  ADD COLUMN IF NOT EXISTS en_name character varying(200),
  ADD COLUMN IF NOT EXISTS translation_status character varying(20) NOT NULL DEFAULT 'translated';

-- Speed up the upsert key + display lookups.
CREATE INDEX IF NOT EXISTS idx_music_source_nodes_game_cat_en
  ON public.music_source_nodes (game_id, category_id, en_name);
