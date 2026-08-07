-- 0014_esa_edge_logs.sql
-- 方案C：ESA 离线日志 → 按 host 过滤后入库（边缘全量视角，纯 music 子域）
-- 数据来源：DescribeSiteLogs 日志包（延迟 6-8 小时），脚本每日拉取

CREATE TABLE IF NOT EXISTS esa_edge_logs (
    id            bigserial PRIMARY KEY,
    req_id        varchar(64)  NOT NULL,             -- ClientRequestID（幂等键）
    ts            timestamptz  NOT NULL,             -- EdgeStartTimestamp
    host          varchar(200) NOT NULL,             -- ClientRequestHost
    method        varchar(10),
    scheme        varchar(10),
    uri           varchar(2048),
    referer       varchar(1024),
    ua            varchar(1024),
    ua_browser    varchar(128),
    ua_os         varchar(128),
    ua_device     varchar(64),
    status        integer,                           -- EdgeResponseStatusCode
    cache_status  varchar(32),                       -- EdgeCacheStatus: HIT/MISS/EXPIRED/DYNAMIC...
    ttfbm_ms      integer,                           -- EdgeTimeToFirstByteMs
    req_bytes     integer,                           -- ClientRequestBytes
    resp_bytes    bigint,                            -- EdgeResponseBytes
    country       varchar(8),                        -- ClientCountryCode
    region        varchar(128),                      -- ClientRegionCode
    isp           varchar(128),                      -- ClientISP
    client_ip     varchar(64),                       -- ClientIP
    ingested_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT esa_edge_logs_req_id_key UNIQUE (req_id)
);

CREATE INDEX IF NOT EXISTS idx_esa_edge_logs_ts ON esa_edge_logs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_esa_edge_logs_host_ts ON esa_edge_logs (host, ts DESC);
CREATE INDEX IF NOT EXISTS idx_esa_edge_logs_country ON esa_edge_logs (country);
CREATE INDEX IF NOT EXISTS idx_esa_edge_logs_cache ON esa_edge_logs (cache_status);

-- 已处理日志包状态（幂等）
CREATE TABLE IF NOT EXISTS esa_log_ingest_state (
    log_name    varchar(255) PRIMARY KEY,
    ingested_at timestamptz NOT NULL DEFAULT now()
);
