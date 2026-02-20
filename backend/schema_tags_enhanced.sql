-- Tag System Enhanced Schema
-- Tag groups and hierarchical structure support

-- 1. Tag Groups table (tag分组)
CREATE TABLE IF NOT EXISTS tag_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),  -- 图标名称
  display_order INTEGER DEFAULT 0,  -- 显示顺序
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Update tags table to support groups and hierarchy
-- Add new columns to existing tags table
ALTER TABLE tags
ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES tag_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_tags_group_id ON tags(group_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tag_groups_name ON tag_groups(name);

-- 4. Auto-update timestamp trigger for tag_groups
CREATE OR REPLACE FUNCTION update_tag_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_group_timestamp
BEFORE UPDATE ON tag_groups
FOR EACH ROW
EXECUTE FUNCTION update_tag_group_timestamp();

-- 5. Insert default tag groups
INSERT INTO tag_groups (name, description, icon, display_order) VALUES
  ('游戏分类', '按游戏系列分类的标签', 'GamepadOutlined', 1),
  ('音乐风格', '音乐风格和类型标签', 'SoundOutlined', 2),
  ('语言', '歌曲语言标签', 'GlobalOutlined', 3),
  ('情感', '音乐情感和氛围标签', 'HeartOutlined', 4),
  ('场景', '适用场景标签', 'EnvironmentOutlined', 5),
  ('其他', '其他分类标签', 'TagsOutlined', 99)
ON CONFLICT (name) DO NOTHING;

-- 6. Comments
COMMENT ON TABLE tag_groups IS 'Tag groups for organizing tags';
COMMENT ON COLUMN tags.group_id IS 'Tag group reference';
COMMENT ON COLUMN tags.parent_id IS 'Parent tag reference for hierarchical structure';
COMMENT ON COLUMN tags.display_order IS 'Display order within group or parent';
COMMENT ON COLUMN tag_groups.display_order IS 'Group display order';

-- 7. Function to get tag hierarchy path
CREATE OR REPLACE FUNCTION get_tag_path(tag_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  path TEXT := '';
  current_id INTEGER := tag_id;
  current_name VARCHAR(50);
  parent_id INTEGER;
BEGIN
  LOOP
    SELECT name, tags.parent_id INTO current_name, parent_id
    FROM tags
    WHERE id = current_id;

    IF current_name IS NULL THEN
      EXIT;
    END IF;

    IF path = '' THEN
      path := current_name;
    ELSE
      path := current_name || ' > ' || path;
    END IF;

    IF parent_id IS NULL THEN
      EXIT;
    END IF;

    current_id := parent_id;
  END LOOP;

  RETURN path;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tag_path IS 'Get full hierarchical path of a tag (e.g., "Game > Genshin > Mondstadt")';

