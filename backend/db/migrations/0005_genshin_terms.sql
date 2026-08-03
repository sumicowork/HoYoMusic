-- 0005_genshin_terms.sql
--
-- A comprehensive, wiki-maintained Genshin proper-noun translation library.
-- One row per canonical English term; carries zhs/zht/ja/ko (+ status) so the
-- music-source tree AND the lrc creator dictionary can BOTH consume it instead
-- of each crawling fandom independently (and risking divergent translations).
--
-- Authority order (matching the rest of the pipeline):
--   fandom {{Other Languages}}  >  follow {{Transclude|base}}  >  (words.json /
--   manual, applied later)  >  leave lang NULL + status = partial / pending.
-- We NEVER guess — missing languages stay NULL.
--
-- Built & maintained by scripts/fandomMusicSource/build_genshin_terms.ts.
-- Idempotent: re-running the crawler only refreshes / upserts rows. Safe to
-- re-run (CREATE TABLE / SEQUENCE / INDEX all use IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.genshin_terms (
    id            integer                     NOT NULL,
    wiki          character varying(40)       NOT NULL DEFAULT 'genshin',
    en_name       character varying(300)      NOT NULL,
    category      character varying(80),
    zhs           character varying(300),
    zht           character varying(300),  -- traditional Chinese
    ja            character varying(300),
    ko            character varying(300),
    source_page   character varying(300),
    status        character varying(20)       NOT NULL DEFAULT 'pending',
    note          text,
    uuid          uuid                        DEFAULT gen_random_uuid(),
    created_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.genshin_terms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.genshin_terms ALTER COLUMN id SET DEFAULT nextval('public.genshin_terms_id_seq'::regclass);

ALTER TABLE ONLY public.genshin_terms
    ADD CONSTRAINT genshin_terms_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.genshin_terms
    ADD CONSTRAINT genshin_terms_wiki_en_name_key UNIQUE (wiki, en_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_genshin_terms_uuid
    ON public.genshin_terms USING btree (uuid);

CREATE INDEX IF NOT EXISTS idx_genshin_terms_status
    ON public.genshin_terms USING btree (status);

CREATE INDEX IF NOT EXISTS idx_genshin_terms_category
    ON public.genshin_terms USING btree (category);

CREATE INDEX IF NOT EXISTS idx_genshin_terms_wiki_cat
    ON public.genshin_terms USING btree (wiki, category);
