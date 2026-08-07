--
-- PostgreSQL database dump
--

\restrict AhQtm2Ct59BLfDDU1I5UFzkasB7kyQJX6y2Dury8thUjeLGlhmx3EY0eQHUKQXn

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: get_tag_path(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tag_path(tag_id integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION get_tag_path(tag_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tag_path(tag_id integer) IS 'Get full hierarchical path of a tag';


--
-- Name: update_artist_avatar_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_artist_avatar_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_tag_group_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tag_group_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_tag_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tag_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: album_discs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.album_discs (
    id integer NOT NULL,
    album_id integer NOT NULL,
    disc_number integer NOT NULL,
    disc_title character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: album_discs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.album_discs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: album_discs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.album_discs_id_seq OWNED BY public.album_discs.id;


--
-- Name: albums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.albums (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    cover_path character varying(500),
    release_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    game_id integer,
    notes text,
    uuid uuid DEFAULT gen_random_uuid(),
    title_cn character varying(500),
    title_en character varying(500),
    source_type character varying(20) DEFAULT 'NORMAL'::character varying NOT NULL,
    CONSTRAINT albums_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['NORMAL'::character varying, 'EXTRA'::character varying])::text[])))
);


--
-- Name: albums_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.albums_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: albums_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.albums_id_seq OWNED BY public.albums.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    setting_key character varying(100) NOT NULL,
    setting_value jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: artist_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist_aliases (
    id integer NOT NULL,
    canonical_name character varying(500) NOT NULL,
    alias_name character varying(500) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: artist_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artist_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artist_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artist_aliases_id_seq OWNED BY public.artist_aliases.id;


--
-- Name: artist_avatars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist_avatars (
    id integer NOT NULL,
    artist_name character varying(500) NOT NULL,
    avatar_path character varying(500) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE artist_avatars; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.artist_avatars IS 'Avatar images for artists (keyed by name since artists are virtual)';


--
-- Name: artist_avatars_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artist_avatars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artist_avatars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artist_avatars_id_seq OWNED BY public.artist_avatars.id;


--
-- Name: artist_role_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist_role_aliases (
    id integer NOT NULL,
    canonical_role character varying(200) NOT NULL,
    alias_role character varying(200) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: artist_role_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artist_role_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artist_role_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artist_role_aliases_id_seq OWNED BY public.artist_role_aliases.id;


--
-- Name: artists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artists (
    id integer NOT NULL,
    name character varying(500) NOT NULL,
    slug character varying(600),
    bio text,
    avatar_path character varying(500),
    type character varying(50) DEFAULT 'person'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: artists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artists_id_seq OWNED BY public.artists.id;


--
-- Name: auth_verification_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_verification_codes (
    id bigint NOT NULL,
    email character varying(200),
    code_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    challenge_id uuid,
    phone character varying(20)
);


--
-- Name: auth_verification_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_verification_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_verification_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auth_verification_codes_id_seq OWNED BY public.auth_verification_codes.id;


--
-- Name: catalog_metadata_import_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_metadata_import_batches (
    id bigint NOT NULL,
    batch_uuid uuid NOT NULL,
    requested_by_user_id integer,
    requested_by_username character varying(100),
    sync_legacy_title boolean DEFAULT false NOT NULL,
    albums_input integer DEFAULT 0 NOT NULL,
    tracks_input integer DEFAULT 0 NOT NULL,
    albums_updated integer DEFAULT 0 NOT NULL,
    tracks_updated integer DEFAULT 0 NOT NULL,
    albums_not_found integer DEFAULT 0 NOT NULL,
    tracks_not_found integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'committed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rolled_back_at timestamp with time zone,
    CONSTRAINT chk_catalog_metadata_import_batch_status CHECK (((status)::text = ANY (ARRAY[('committed'::character varying)::text, ('rolled_back'::character varying)::text])))
);


--
-- Name: catalog_metadata_import_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catalog_metadata_import_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalog_metadata_import_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catalog_metadata_import_batches_id_seq OWNED BY public.catalog_metadata_import_batches.id;


--
-- Name: catalog_metadata_import_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_metadata_import_changes (
    id bigint NOT NULL,
    batch_uuid uuid NOT NULL,
    entity_type character varying(10) NOT NULL,
    entity_uuid uuid NOT NULL,
    entity_id integer,
    before_title character varying(500),
    before_title_cn character varying(500),
    before_title_en character varying(500),
    after_title character varying(500),
    after_title_cn character varying(500),
    after_title_en character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_catalog_metadata_import_change_entity_type CHECK (((entity_type)::text = ANY (ARRAY[('album'::character varying)::text, ('track'::character varying)::text])))
);


--
-- Name: catalog_metadata_import_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catalog_metadata_import_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalog_metadata_import_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catalog_metadata_import_changes_id_seq OWNED BY public.catalog_metadata_import_changes.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id bigint NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    ip character varying(64),
    user_agent character varying(500),
    report_count integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    deleted_by integer,
    CONSTRAINT comments_content_check CHECK (((length(content) >= 1) AND (length(content) <= 2000))),
    CONSTRAINT comments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT comments_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['track'::character varying, 'album'::character varying, 'game'::character varying, 'artist'::character varying])::text[])))
);


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: credit_role_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_role_map (
    role_key character varying(200) NOT NULL,
    role_norm character varying(100) NOT NULL,
    role_en character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: esa_edge_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.esa_edge_logs (
    id bigint NOT NULL,
    req_id character varying(64) NOT NULL,
    ts timestamp with time zone NOT NULL,
    host character varying(200) NOT NULL,
    method character varying(10),
    scheme character varying(10),
    uri character varying(2048),
    referer character varying(1024),
    ua character varying(1024),
    ua_browser character varying(128),
    ua_os character varying(128),
    ua_device character varying(64),
    status integer,
    cache_status character varying(32),
    ttfbm_ms integer,
    req_bytes integer,
    resp_bytes bigint,
    country character varying(8),
    region character varying(128),
    isp character varying(128),
    client_ip character varying(64),
    ingested_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: esa_edge_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.esa_edge_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: esa_edge_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.esa_edge_logs_id_seq OWNED BY public.esa_edge_logs.id;


--
-- Name: esa_log_ingest_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.esa_log_ingest_state (
    log_name character varying(255) NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    user_id integer NOT NULL,
    track_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: feedback_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback_messages (
    id bigint NOT NULL,
    content text NOT NULL,
    contact character varying(200),
    ip character varying(64),
    user_agent character varying(512),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feedback_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feedback_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feedback_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feedback_messages_id_seq OWNED BY public.feedback_messages.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    name_en character varying(100),
    description text,
    cover_path character varying(500),
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL
);


--
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- Name: genshin_terms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.genshin_terms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: genshin_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.genshin_terms (
    id integer DEFAULT nextval('public.genshin_terms_id_seq'::regclass) NOT NULL,
    wiki character varying(40) DEFAULT 'genshin'::character varying NOT NULL,
    en_name character varying(300) NOT NULL,
    category character varying(80),
    zhs character varying(300),
    zht character varying(300),
    ja character varying(300),
    ko character varying(300),
    source_page character varying(300),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    note text,
    uuid uuid DEFAULT gen_random_uuid(),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: music_source_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.music_source_categories (
    id integer NOT NULL,
    game_id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    uuid uuid DEFAULT gen_random_uuid(),
    en_name character varying(200),
    translation_status character varying(20) DEFAULT 'translated'::character varying NOT NULL
);


--
-- Name: music_source_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.music_source_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: music_source_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.music_source_categories_id_seq OWNED BY public.music_source_categories.id;


--
-- Name: music_source_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.music_source_nodes (
    id integer NOT NULL,
    game_id integer NOT NULL,
    category_id integer NOT NULL,
    parent_id integer,
    name character varying(200) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    uuid uuid DEFAULT gen_random_uuid(),
    en_name character varying(200),
    translation_status character varying(20) DEFAULT 'pending'::character varying NOT NULL
);


--
-- Name: music_source_nodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.music_source_nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: music_source_nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.music_source_nodes_id_seq OWNED BY public.music_source_nodes.id;


--
-- Name: playlist_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist_tracks (
    playlist_id integer NOT NULL,
    track_id integer NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlists (
    id integer NOT NULL,
    user_id integer,
    name character varying(200) NOT NULL,
    description text,
    cover_path character varying(500),
    is_public boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlists_id_seq OWNED BY public.playlists.id;


--
-- Name: ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ratings (
    id bigint NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id integer NOT NULL,
    user_id integer NOT NULL,
    score smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ratings_score_check CHECK (((score >= 1) AND (score <= 5))),
    CONSTRAINT ratings_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['track'::character varying, 'album'::character varying, 'game'::character varying, 'artist'::character varying])::text[])))
);


--
-- Name: ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ratings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ratings_id_seq OWNED BY public.ratings.id;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id bigint NOT NULL,
    comment_id bigint NOT NULL,
    reporter_id integer NOT NULL,
    reason character varying(100) NOT NULL,
    detail character varying(500),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_at timestamp with time zone,
    handler_id integer,
    CONSTRAINT reports_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'handled'::character varying, 'ignored'::character varying])::text[])))
);


--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- Name: site_message_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_message_deliveries (
    id bigint NOT NULL,
    message_id bigint NOT NULL,
    recipient_user_id integer NOT NULL,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: site_message_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_message_deliveries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_message_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_message_deliveries_id_seq OWNED BY public.site_message_deliveries.id;


--
-- Name: site_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_messages (
    id bigint NOT NULL,
    sender_user_id integer,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    is_broadcast boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);


--
-- Name: site_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_messages_id_seq OWNED BY public.site_messages.id;


--
-- Name: sms_send_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_send_log (
    id bigint NOT NULL,
    phone character varying(20) NOT NULL,
    purpose character varying(20) DEFAULT 'phone_bind'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sms_send_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sms_send_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sms_send_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sms_send_log_id_seq OWNED BY public.sms_send_log.id;


--
-- Name: tag_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag_groups (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    icon character varying(50),
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_group_id integer
);


--
-- Name: TABLE tag_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tag_groups IS 'Tag groups for organizing tags';


--
-- Name: COLUMN tag_groups.display_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tag_groups.display_order IS 'Group display order';


--
-- Name: COLUMN tag_groups.parent_group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tag_groups.parent_group_id IS 'Parent group ID for nested group hierarchy. NULL = top-level group.';


--
-- Name: tag_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tag_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tag_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tag_groups_id_seq OWNED BY public.tag_groups.id;


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    color character varying(20) DEFAULT '#1890ff'::character varying,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    group_id integer,
    parent_id integer,
    display_order integer DEFAULT 0,
    icon character varying(50)
);


--
-- Name: TABLE tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tags IS 'Music tags for categorization';


--
-- Name: COLUMN tags.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tags.color IS 'Tag display color in hex format';


--
-- Name: COLUMN tags.group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tags.group_id IS 'Tag group reference';


--
-- Name: COLUMN tags.parent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tags.parent_id IS 'Parent tag reference for hierarchical structure';


--
-- Name: COLUMN tags.display_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tags.display_order IS 'Display order within group or parent';


--
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;


--
-- Name: track_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_credits (
    id integer NOT NULL,
    track_id integer NOT NULL,
    credit_key character varying(100) NOT NULL,
    credit_value text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    artist_id integer,
    credit_role_norm character varying(100)
);


--
-- Name: track_credits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.track_credits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: track_credits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.track_credits_id_seq OWNED BY public.track_credits.id;


--
-- Name: track_music_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_music_sources (
    id bigint NOT NULL,
    track_id integer NOT NULL,
    game_id integer NOT NULL,
    category_id integer NOT NULL,
    node_id integer NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    note text
);


--
-- Name: track_music_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.track_music_sources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: track_music_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.track_music_sources_id_seq OWNED BY public.track_music_sources.id;


--
-- Name: track_play_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_play_events (
    id bigint NOT NULL,
    track_id integer NOT NULL,
    played_seconds numeric(10,2) DEFAULT 0 NOT NULL,
    track_duration_seconds numeric(10,2),
    min_required_seconds numeric(10,2) NOT NULL,
    effective_play boolean DEFAULT false NOT NULL,
    source_ip character varying(64),
    user_agent text,
    session_key character varying(128) NOT NULL,
    played_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: track_play_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.track_play_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: track_play_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.track_play_events_id_seq OWNED BY public.track_play_events.id;


--
-- Name: track_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_tags (
    id integer NOT NULL,
    track_id integer NOT NULL,
    tag_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE track_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.track_tags IS 'Track and tag association';


--
-- Name: track_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.track_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: track_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.track_tags_id_seq OWNED BY public.track_tags.id;


--
-- Name: tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    album_id integer,
    file_path character varying(500) NOT NULL,
    cover_path character varying(500),
    duration integer,
    track_number integer,
    sample_rate integer,
    bit_depth integer,
    file_size bigint,
    release_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    lyrics_path character varying(500),
    sha256_hash character varying(64),
    play_count integer DEFAULT 0,
    notes text,
    disc_id integer,
    lyrics_status character varying(20) DEFAULT 'none'::character varying NOT NULL,
    uuid uuid DEFAULT gen_random_uuid(),
    title_cn character varying(500),
    title_en character varying(500),
    lyrics_text text,
    lyrics_analysis_status character varying(20) DEFAULT 'none'::character varying NOT NULL,
    CONSTRAINT chk_tracks_lyrics_status CHECK (((lyrics_status)::text = ANY ((ARRAY['none'::character varying, 'has'::character varying, 'instrumental'::character varying])::text[])))
);


--
-- Name: tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tracks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tracks_id_seq OWNED BY public.tracks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(200),
    email_verified boolean DEFAULT false NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    account_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    status_reason character varying(500),
    last_login_at timestamp with time zone,
    last_login_ip character varying(64),
    token_version integer DEFAULT 0 NOT NULL,
    phone character varying(20),
    phone_verified boolean DEFAULT false NOT NULL,
    accept_terms_at timestamp with time zone,
    CONSTRAINT users_account_status_check CHECK (((account_status)::text = ANY (ARRAY[('active'::character varying)::text, ('disabled'::character varying)::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: visit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_logs (
    id bigint NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    ip character varying(64),
    country character varying(4),
    region character varying(128),
    city character varying(128),
    latitude numeric(9,6),
    longitude numeric(9,6),
    method character varying(10),
    path character varying(1024),
    status smallint,
    duration_ms integer,
    user_agent text,
    ua_browser character varying(128),
    ua_os character varying(128),
    ua_device character varying(64),
    referer character varying(1024),
    bytes_sent integer,
    visitor_id character varying(128),
    actor_user_id integer,
    actor_username character varying(128),
    category character varying(20) DEFAULT 'normal'::character varying NOT NULL
);


--
-- Name: visit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visit_logs_id_seq OWNED BY public.visit_logs.id;


--
-- Name: album_discs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_discs ALTER COLUMN id SET DEFAULT nextval('public.album_discs_id_seq'::regclass);


--
-- Name: albums id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.albums ALTER COLUMN id SET DEFAULT nextval('public.albums_id_seq'::regclass);


--
-- Name: artist_aliases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_aliases ALTER COLUMN id SET DEFAULT nextval('public.artist_aliases_id_seq'::regclass);


--
-- Name: artist_avatars id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_avatars ALTER COLUMN id SET DEFAULT nextval('public.artist_avatars_id_seq'::regclass);


--
-- Name: artist_role_aliases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_role_aliases ALTER COLUMN id SET DEFAULT nextval('public.artist_role_aliases_id_seq'::regclass);


--
-- Name: artists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists ALTER COLUMN id SET DEFAULT nextval('public.artists_id_seq'::regclass);


--
-- Name: auth_verification_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_verification_codes ALTER COLUMN id SET DEFAULT nextval('public.auth_verification_codes_id_seq'::regclass);


--
-- Name: catalog_metadata_import_batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_metadata_import_batches ALTER COLUMN id SET DEFAULT nextval('public.catalog_metadata_import_batches_id_seq'::regclass);


--
-- Name: catalog_metadata_import_changes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_metadata_import_changes ALTER COLUMN id SET DEFAULT nextval('public.catalog_metadata_import_changes_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: esa_edge_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esa_edge_logs ALTER COLUMN id SET DEFAULT nextval('public.esa_edge_logs_id_seq'::regclass);


--
-- Name: feedback_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_messages ALTER COLUMN id SET DEFAULT nextval('public.feedback_messages_id_seq'::regclass);


--
-- Name: games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- Name: music_source_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_categories ALTER COLUMN id SET DEFAULT nextval('public.music_source_categories_id_seq'::regclass);


--
-- Name: music_source_nodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_nodes ALTER COLUMN id SET DEFAULT nextval('public.music_source_nodes_id_seq'::regclass);


--
-- Name: playlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists ALTER COLUMN id SET DEFAULT nextval('public.playlists_id_seq'::regclass);


--
-- Name: ratings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings ALTER COLUMN id SET DEFAULT nextval('public.ratings_id_seq'::regclass);


--
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- Name: site_message_deliveries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_message_deliveries ALTER COLUMN id SET DEFAULT nextval('public.site_message_deliveries_id_seq'::regclass);


--
-- Name: site_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_messages ALTER COLUMN id SET DEFAULT nextval('public.site_messages_id_seq'::regclass);


--
-- Name: sms_send_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_log ALTER COLUMN id SET DEFAULT nextval('public.sms_send_log_id_seq'::regclass);


--
-- Name: tag_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_groups ALTER COLUMN id SET DEFAULT nextval('public.tag_groups_id_seq'::regclass);


--
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);


--
-- Name: track_credits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_credits ALTER COLUMN id SET DEFAULT nextval('public.track_credits_id_seq'::regclass);


--
-- Name: track_music_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_music_sources ALTER COLUMN id SET DEFAULT nextval('public.track_music_sources_id_seq'::regclass);


--
-- Name: track_play_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_play_events ALTER COLUMN id SET DEFAULT nextval('public.track_play_events_id_seq'::regclass);


--
-- Name: track_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags ALTER COLUMN id SET DEFAULT nextval('public.track_tags_id_seq'::regclass);


--
-- Name: tracks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks ALTER COLUMN id SET DEFAULT nextval('public.tracks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: visit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_logs ALTER COLUMN id SET DEFAULT nextval('public.visit_logs_id_seq'::regclass);


--
-- Name: album_discs album_discs_album_id_disc_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_discs
    ADD CONSTRAINT album_discs_album_id_disc_number_key UNIQUE (album_id, disc_number);


--
-- Name: album_discs album_discs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_discs
    ADD CONSTRAINT album_discs_pkey PRIMARY KEY (id);


--
-- Name: albums albums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (setting_key);


--
-- Name: artist_aliases artist_aliases_canonical_name_alias_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_aliases
    ADD CONSTRAINT artist_aliases_canonical_name_alias_name_key UNIQUE (canonical_name, alias_name);


--
-- Name: artist_aliases artist_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_aliases
    ADD CONSTRAINT artist_aliases_pkey PRIMARY KEY (id);


--
-- Name: artist_avatars artist_avatars_artist_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_avatars
    ADD CONSTRAINT artist_avatars_artist_name_key UNIQUE (artist_name);


--
-- Name: artist_avatars artist_avatars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_avatars
    ADD CONSTRAINT artist_avatars_pkey PRIMARY KEY (id);


--
-- Name: artist_role_aliases artist_role_aliases_canonical_role_alias_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_role_aliases
    ADD CONSTRAINT artist_role_aliases_canonical_role_alias_role_key UNIQUE (canonical_role, alias_role);


--
-- Name: artist_role_aliases artist_role_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_role_aliases
    ADD CONSTRAINT artist_role_aliases_pkey PRIMARY KEY (id);


--
-- Name: artists artists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists
    ADD CONSTRAINT artists_pkey PRIMARY KEY (id);


--
-- Name: artists artists_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists
    ADD CONSTRAINT artists_slug_key UNIQUE (slug);


--
-- Name: auth_verification_codes auth_verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_verification_codes
    ADD CONSTRAINT auth_verification_codes_pkey PRIMARY KEY (id);


--
-- Name: catalog_metadata_import_batches catalog_metadata_import_batches_batch_uuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_metadata_import_batches
    ADD CONSTRAINT catalog_metadata_import_batches_batch_uuid_key UNIQUE (batch_uuid);


--
-- Name: catalog_metadata_import_batches catalog_metadata_import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_metadata_import_batches
    ADD CONSTRAINT catalog_metadata_import_batches_pkey PRIMARY KEY (id);


--
-- Name: catalog_metadata_import_changes catalog_metadata_import_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_metadata_import_changes
    ADD CONSTRAINT catalog_metadata_import_changes_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: credit_role_map credit_role_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_role_map
    ADD CONSTRAINT credit_role_map_pkey PRIMARY KEY (role_key);


--
-- Name: esa_edge_logs esa_edge_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esa_edge_logs
    ADD CONSTRAINT esa_edge_logs_pkey PRIMARY KEY (id);


--
-- Name: esa_edge_logs esa_edge_logs_req_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esa_edge_logs
    ADD CONSTRAINT esa_edge_logs_req_id_key UNIQUE (req_id);


--
-- Name: esa_log_ingest_state esa_log_ingest_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esa_log_ingest_state
    ADD CONSTRAINT esa_log_ingest_state_pkey PRIMARY KEY (log_name);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, track_id);


--
-- Name: feedback_messages feedback_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_messages
    ADD CONSTRAINT feedback_messages_pkey PRIMARY KEY (id);


--
-- Name: games games_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_name_key UNIQUE (name);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: genshin_terms genshin_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genshin_terms
    ADD CONSTRAINT genshin_terms_pkey PRIMARY KEY (id);


--
-- Name: genshin_terms genshin_terms_wiki_en_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genshin_terms
    ADD CONSTRAINT genshin_terms_wiki_en_name_key UNIQUE (wiki, en_name);


--
-- Name: music_source_categories music_source_categories_game_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_categories
    ADD CONSTRAINT music_source_categories_game_id_name_key UNIQUE (game_id, name);


--
-- Name: music_source_categories music_source_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_categories
    ADD CONSTRAINT music_source_categories_pkey PRIMARY KEY (id);


--
-- Name: music_source_nodes music_source_nodes_game_id_category_id_parent_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_nodes
    ADD CONSTRAINT music_source_nodes_game_id_category_id_parent_id_name_key UNIQUE (game_id, category_id, parent_id, name);


--
-- Name: music_source_nodes music_source_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_nodes
    ADD CONSTRAINT music_source_nodes_pkey PRIMARY KEY (id);


--
-- Name: playlist_tracks playlist_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_pkey PRIMARY KEY (playlist_id, track_id);


--
-- Name: playlists playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_target_user_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_target_user_uq UNIQUE (target_type, target_id, user_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: site_message_deliveries site_message_deliveries_message_id_recipient_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_message_deliveries
    ADD CONSTRAINT site_message_deliveries_message_id_recipient_user_id_key UNIQUE (message_id, recipient_user_id);


--
-- Name: site_message_deliveries site_message_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_message_deliveries
    ADD CONSTRAINT site_message_deliveries_pkey PRIMARY KEY (id);


--
-- Name: site_messages site_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_messages
    ADD CONSTRAINT site_messages_pkey PRIMARY KEY (id);


--
-- Name: sms_send_log sms_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_send_log
    ADD CONSTRAINT sms_send_log_pkey PRIMARY KEY (id);


--
-- Name: tag_groups tag_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_groups
    ADD CONSTRAINT tag_groups_name_key UNIQUE (name);


--
-- Name: tag_groups tag_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_groups
    ADD CONSTRAINT tag_groups_pkey PRIMARY KEY (id);


--
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: track_credits track_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_credits
    ADD CONSTRAINT track_credits_pkey PRIMARY KEY (id);


--
-- Name: track_music_sources track_music_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_music_sources
    ADD CONSTRAINT track_music_sources_pkey PRIMARY KEY (id);


--
-- Name: track_music_sources track_music_sources_track_id_node_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_music_sources
    ADD CONSTRAINT track_music_sources_track_id_node_id_key UNIQUE (track_id, node_id);


--
-- Name: track_play_events track_play_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_play_events
    ADD CONSTRAINT track_play_events_pkey PRIMARY KEY (id);


--
-- Name: track_play_events track_play_events_track_id_session_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_play_events
    ADD CONSTRAINT track_play_events_track_id_session_key_key UNIQUE (track_id, session_key);


--
-- Name: track_tags track_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags
    ADD CONSTRAINT track_tags_pkey PRIMARY KEY (id);


--
-- Name: track_tags track_tags_track_id_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags
    ADD CONSTRAINT track_tags_track_id_tag_id_key UNIQUE (track_id, tag_id);


--
-- Name: tracks tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: visit_logs visit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_logs
    ADD CONSTRAINT visit_logs_pkey PRIMARY KEY (id);


--
-- Name: avc_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX avc_phone_idx ON public.auth_verification_codes USING btree (phone);


--
-- Name: comments_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_target_idx ON public.comments USING btree (target_type, target_id, status, created_at DESC);


--
-- Name: comments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_user_idx ON public.comments USING btree (user_id);


--
-- Name: idx_album_discs_album; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_album_discs_album ON public.album_discs USING btree (album_id);


--
-- Name: idx_albums_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_albums_game_id ON public.albums USING btree (game_id);


--
-- Name: idx_albums_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_albums_title ON public.albums USING btree (title);


--
-- Name: idx_albums_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_albums_uuid ON public.albums USING btree (uuid);


--
-- Name: idx_artist_aliases_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_aliases_alias ON public.artist_aliases USING btree (lower((alias_name)::text));


--
-- Name: idx_artist_aliases_canonical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_aliases_canonical ON public.artist_aliases USING btree (lower((canonical_name)::text));


--
-- Name: idx_artist_avatars_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_avatars_name ON public.artist_avatars USING btree (artist_name);


--
-- Name: idx_artist_role_aliases_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_role_aliases_alias ON public.artist_role_aliases USING btree (lower((alias_role)::text));


--
-- Name: idx_artist_role_aliases_canonical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_role_aliases_canonical ON public.artist_role_aliases USING btree (lower((canonical_role)::text));


--
-- Name: idx_artists_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artists_name ON public.artists USING btree (name);


--
-- Name: idx_artists_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artists_slug ON public.artists USING btree (slug);


--
-- Name: idx_auth_codes_challenge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_codes_challenge ON public.auth_verification_codes USING btree (challenge_id);


--
-- Name: idx_auth_codes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_codes_email ON public.auth_verification_codes USING btree (lower((email)::text), created_at DESC);


--
-- Name: idx_auth_codes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_codes_expires ON public.auth_verification_codes USING btree (expires_at);


--
-- Name: idx_catalog_metadata_batches_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_metadata_batches_created_at ON public.catalog_metadata_import_batches USING btree (created_at DESC);


--
-- Name: idx_catalog_metadata_batches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_metadata_batches_status ON public.catalog_metadata_import_batches USING btree (status);


--
-- Name: idx_catalog_metadata_changes_batch_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_metadata_changes_batch_uuid ON public.catalog_metadata_import_changes USING btree (batch_uuid);


--
-- Name: idx_catalog_metadata_changes_entity_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_metadata_changes_entity_uuid ON public.catalog_metadata_import_changes USING btree (entity_uuid);


--
-- Name: idx_esa_edge_logs_cache; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_esa_edge_logs_cache ON public.esa_edge_logs USING btree (cache_status);


--
-- Name: idx_esa_edge_logs_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_esa_edge_logs_country ON public.esa_edge_logs USING btree (country);


--
-- Name: idx_esa_edge_logs_host_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_esa_edge_logs_host_ts ON public.esa_edge_logs USING btree (host, ts DESC);


--
-- Name: idx_esa_edge_logs_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_esa_edge_logs_ts ON public.esa_edge_logs USING btree (ts DESC);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id);


--
-- Name: idx_feedback_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_messages_created_at ON public.feedback_messages USING btree (created_at DESC);


--
-- Name: idx_genshin_terms_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genshin_terms_category ON public.genshin_terms USING btree (category);


--
-- Name: idx_genshin_terms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genshin_terms_status ON public.genshin_terms USING btree (status);


--
-- Name: idx_genshin_terms_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_genshin_terms_uuid ON public.genshin_terms USING btree (uuid);


--
-- Name: idx_genshin_terms_wiki_cat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genshin_terms_wiki_cat ON public.genshin_terms USING btree (wiki, category);


--
-- Name: idx_music_source_categories_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_music_source_categories_game ON public.music_source_categories USING btree (game_id);


--
-- Name: idx_music_source_categories_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_music_source_categories_uuid ON public.music_source_categories USING btree (uuid);


--
-- Name: idx_music_source_nodes_game_cat_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_music_source_nodes_game_cat_en ON public.music_source_nodes USING btree (game_id, category_id, en_name);


--
-- Name: idx_music_source_nodes_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_music_source_nodes_lookup ON public.music_source_nodes USING btree (game_id, category_id, parent_id, display_order, name);


--
-- Name: idx_music_source_nodes_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_music_source_nodes_uuid ON public.music_source_nodes USING btree (uuid);


--
-- Name: idx_playlist_tracks_playlist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_tracks_playlist ON public.playlist_tracks USING btree (playlist_id);


--
-- Name: idx_playlists_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlists_user ON public.playlists USING btree (user_id);


--
-- Name: idx_site_message_deliveries_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_message_deliveries_unread ON public.site_message_deliveries USING btree (recipient_user_id, is_read);


--
-- Name: idx_site_message_deliveries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_message_deliveries_user ON public.site_message_deliveries USING btree (recipient_user_id, delivered_at DESC);


--
-- Name: idx_tag_groups_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_groups_name ON public.tag_groups USING btree (name);


--
-- Name: idx_tag_groups_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_groups_parent ON public.tag_groups USING btree (parent_group_id);


--
-- Name: idx_tags_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_group_id ON public.tags USING btree (group_id);


--
-- Name: idx_tags_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_name ON public.tags USING btree (name);


--
-- Name: idx_tags_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_parent_id ON public.tags USING btree (parent_id);


--
-- Name: idx_track_credits_artist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_credits_artist_id ON public.track_credits USING btree (artist_id);


--
-- Name: idx_track_credits_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_credits_order ON public.track_credits USING btree (track_id, display_order);


--
-- Name: idx_track_credits_track_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_credits_track_id ON public.track_credits USING btree (track_id);


--
-- Name: idx_track_music_sources_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_music_sources_category ON public.track_music_sources USING btree (category_id);


--
-- Name: idx_track_music_sources_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_music_sources_game ON public.track_music_sources USING btree (game_id);


--
-- Name: idx_track_music_sources_node; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_music_sources_node ON public.track_music_sources USING btree (node_id);


--
-- Name: idx_track_music_sources_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_music_sources_note ON public.track_music_sources USING btree (note) WHERE (note IS NOT NULL);


--
-- Name: idx_track_music_sources_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_music_sources_track ON public.track_music_sources USING btree (track_id);


--
-- Name: idx_track_play_events_played_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_play_events_played_at ON public.track_play_events USING btree (played_at DESC);


--
-- Name: idx_track_play_events_source_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_play_events_source_ip ON public.track_play_events USING btree (source_ip);


--
-- Name: idx_track_play_events_track_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_play_events_track_effective ON public.track_play_events USING btree (track_id, effective_play, played_at DESC);


--
-- Name: idx_track_tags_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_tags_tag_id ON public.track_tags USING btree (tag_id);


--
-- Name: idx_track_tags_track_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_tags_track_id ON public.track_tags USING btree (track_id);


--
-- Name: idx_tracks_album_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_album_id ON public.tracks USING btree (album_id);


--
-- Name: idx_tracks_disc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_disc_id ON public.tracks USING btree (disc_id);


--
-- Name: idx_tracks_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_hash ON public.tracks USING btree (sha256_hash) WHERE (sha256_hash IS NOT NULL);


--
-- Name: idx_tracks_lyrics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_lyrics ON public.tracks USING btree (lyrics_path) WHERE (lyrics_path IS NOT NULL);


--
-- Name: idx_tracks_lyrics_analysis_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_lyrics_analysis_status ON public.tracks USING btree (lyrics_analysis_status) WHERE ((lyrics_analysis_status)::text = ANY ((ARRAY['pending'::character varying, 'review'::character varying])::text[]));


--
-- Name: idx_tracks_lyrics_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_lyrics_status ON public.tracks USING btree (lyrics_status);


--
-- Name: idx_tracks_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_title ON public.tracks USING btree (title);


--
-- Name: idx_tracks_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tracks_uuid ON public.tracks USING btree (uuid);


--
-- Name: idx_users_account_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_account_status ON public.users USING btree (account_status);


--
-- Name: idx_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email_lower ON public.users USING btree (lower((email)::text)) WHERE (email IS NOT NULL);


--
-- Name: idx_visit_logs_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_logs_actor_user_id ON public.visit_logs USING btree (actor_user_id);


--
-- Name: idx_visit_logs_actor_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_logs_actor_username ON public.visit_logs USING btree (actor_username);


--
-- Name: idx_visit_logs_category_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_logs_category_ts ON public.visit_logs USING btree (category, ts DESC);


--
-- Name: idx_visit_logs_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_logs_country ON public.visit_logs USING btree (country);


--
-- Name: idx_visit_logs_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_logs_path ON public.visit_logs USING btree (path text_pattern_ops);


--
-- Name: idx_visit_logs_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_logs_ts ON public.visit_logs USING btree (ts DESC);


--
-- Name: idx_visit_logs_visitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_logs_visitor_id ON public.visit_logs USING btree (visitor_id);


--
-- Name: ratings_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ratings_target_idx ON public.ratings USING btree (target_type, target_id);


--
-- Name: reports_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_status_idx ON public.reports USING btree (status, created_at);


--
-- Name: sms_send_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_send_log_created_idx ON public.sms_send_log USING btree (created_at);


--
-- Name: sms_send_log_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_send_log_phone_idx ON public.sms_send_log USING btree (phone, created_at DESC);


--
-- Name: users_phone_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_phone_uq ON public.users USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: artist_avatars trigger_update_artist_avatar_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_artist_avatar_timestamp BEFORE UPDATE ON public.artist_avatars FOR EACH ROW EXECUTE FUNCTION public.update_artist_avatar_timestamp();


--
-- Name: tag_groups trigger_update_tag_group_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_tag_group_timestamp BEFORE UPDATE ON public.tag_groups FOR EACH ROW EXECUTE FUNCTION public.update_tag_group_timestamp();


--
-- Name: tags trigger_update_tag_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_tag_timestamp BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.update_tag_timestamp();


--
-- Name: games update_games_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: album_discs album_discs_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album_discs
    ADD CONSTRAINT album_discs_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id) ON DELETE CASCADE;


--
-- Name: albums albums_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE SET NULL;


--
-- Name: catalog_metadata_import_batches catalog_metadata_import_batches_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_metadata_import_batches
    ADD CONSTRAINT catalog_metadata_import_batches_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: catalog_metadata_import_changes catalog_metadata_import_changes_batch_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_metadata_import_changes
    ADD CONSTRAINT catalog_metadata_import_changes_batch_uuid_fkey FOREIGN KEY (batch_uuid) REFERENCES public.catalog_metadata_import_batches(batch_uuid) ON DELETE CASCADE;


--
-- Name: comments comments_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: comments comments_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: favorites favorites_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: track_credits fk_track_credits_artist; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_credits
    ADD CONSTRAINT fk_track_credits_artist FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE SET NULL;


--
-- Name: music_source_categories music_source_categories_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_categories
    ADD CONSTRAINT music_source_categories_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: music_source_nodes music_source_nodes_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_nodes
    ADD CONSTRAINT music_source_nodes_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.music_source_categories(id) ON DELETE CASCADE;


--
-- Name: music_source_nodes music_source_nodes_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_nodes
    ADD CONSTRAINT music_source_nodes_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: music_source_nodes music_source_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_source_nodes
    ADD CONSTRAINT music_source_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.music_source_nodes(id) ON DELETE CASCADE;


--
-- Name: playlist_tracks playlist_tracks_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;


--
-- Name: playlist_tracks playlist_tracks_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: playlists playlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reports reports_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: reports reports_handler_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_handler_id_fkey FOREIGN KEY (handler_id) REFERENCES public.users(id);


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: site_message_deliveries site_message_deliveries_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_message_deliveries
    ADD CONSTRAINT site_message_deliveries_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.site_messages(id) ON DELETE CASCADE;


--
-- Name: site_message_deliveries site_message_deliveries_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_message_deliveries
    ADD CONSTRAINT site_message_deliveries_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: site_messages site_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_messages
    ADD CONSTRAINT site_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tag_groups tag_groups_parent_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_groups
    ADD CONSTRAINT tag_groups_parent_group_id_fkey FOREIGN KEY (parent_group_id) REFERENCES public.tag_groups(id) ON DELETE CASCADE;


--
-- Name: tags tags_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.tag_groups(id) ON DELETE SET NULL;


--
-- Name: tags tags_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: track_credits track_credits_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_credits
    ADD CONSTRAINT track_credits_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: track_music_sources track_music_sources_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_music_sources
    ADD CONSTRAINT track_music_sources_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.music_source_categories(id) ON DELETE CASCADE;


--
-- Name: track_music_sources track_music_sources_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_music_sources
    ADD CONSTRAINT track_music_sources_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: track_music_sources track_music_sources_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_music_sources
    ADD CONSTRAINT track_music_sources_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.music_source_nodes(id) ON DELETE CASCADE;


--
-- Name: track_music_sources track_music_sources_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_music_sources
    ADD CONSTRAINT track_music_sources_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: track_play_events track_play_events_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_play_events
    ADD CONSTRAINT track_play_events_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: track_tags track_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags
    ADD CONSTRAINT track_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: track_tags track_tags_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags
    ADD CONSTRAINT track_tags_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: tracks tracks_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id) ON DELETE SET NULL;


--
-- Name: tracks tracks_disc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_disc_id_fkey FOREIGN KEY (disc_id) REFERENCES public.album_discs(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict AhQtm2Ct59BLfDDU1I5UFzkasB7kyQJX6y2Dury8thUjeLGlhmx3EY0eQHUKQXn

