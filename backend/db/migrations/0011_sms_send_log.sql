-- 0011_sms_send_log.sql
-- 短信发送日志表：手机号维度限流（防短信轰炸）+ 发送记录留存（合规审计）
-- 策略：同一手机号 60 秒内仅 1 条；每自然日（UTC+8）最多 10 条

CREATE TABLE IF NOT EXISTS sms_send_log (
    id bigserial PRIMARY KEY,
    phone varchar(20) NOT NULL,
    purpose varchar(20) NOT NULL DEFAULT 'phone_bind',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_send_log_phone_idx ON sms_send_log (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS sms_send_log_created_idx ON sms_send_log (created_at);
