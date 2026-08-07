-- 0013_visit_logs_category.sql
-- 方案C：访问日志全量留存 + 分类标记（统计过滤用，审计/协查看全量）
-- category: normal=正常用户流量 | scanner=攻击扫描探测 | bot=搜索引擎爬虫/监控
-- 静态高频资源（js/css/img/字体）仍不入库（见 visitLogger SKIP_PATTERNS）

ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS category varchar(20) NOT NULL DEFAULT 'normal';
CREATE INDEX IF NOT EXISTS idx_visit_logs_category_ts ON visit_logs (category, ts DESC);
