-- 添加游戏分类支持

-- 创建游戏表
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100),
  description TEXT,
  cover_path VARCHAR(500),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 为 albums 表添加游戏ID字段
ALTER TABLE albums ADD COLUMN IF NOT EXISTS game_id INTEGER REFERENCES games(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_albums_game_id ON albums(game_id);

-- Insert default game data
INSERT INTO games (name, name_en, display_order) VALUES
  (E'原神', 'Genshin Impact', 1),
  (E'崩坏：星穹铁道', 'Honkai: Star Rail', 2),
  (E'绝区零', 'Zenless Zone Zero', 3)
ON CONFLICT (name) DO NOTHING;

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


