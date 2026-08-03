-- 0006_lyrics_analysis.sql — AI 歌词分析（迁移 0006）
-- status: none=未分析 / pending=排队中 / done=完成 / failed=失败(可重试) / review=待人工确认
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lyrics_text TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lyrics_analysis_status VARCHAR(20) NOT NULL DEFAULT 'none';
CREATE INDEX IF NOT EXISTS idx_tracks_lyrics_analysis_status
  ON tracks (lyrics_analysis_status)
  WHERE lyrics_analysis_status IN ('pending', 'review');
