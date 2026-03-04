-- Artist Aliases table for merging artists without modifying original data
CREATE TABLE IF NOT EXISTS artist_aliases (
    id SERIAL PRIMARY KEY,
    canonical_name VARCHAR(500) NOT NULL,   -- 主名称（规范名称）
    alias_name VARCHAR(500) NOT NULL,       -- 别名
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(canonical_name, alias_name)
);

-- Index for fast lookup by alias
CREATE INDEX IF NOT EXISTS idx_artist_aliases_alias
ON artist_aliases (LOWER(alias_name));

-- Index for fast lookup by canonical name
CREATE INDEX IF NOT EXISTS idx_artist_aliases_canonical
ON artist_aliases (LOWER(canonical_name));


