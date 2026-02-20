# Tag数据库迁移脚本 - 快速执行指南

**问题**: 字符编码错误（GBK vs UTF8）  
**解决**: 使用UTF-8编码的SQL文件

---

## 🚀 执行迁移（3种方法）

### 方法1: 使用UTF-8文件 (推荐) ⭐

```powershell
# 进入后端目录
cd C:\Users\sumi\WebstormProjects\HoYoMusic\backend

# 执行UTF-8版本
psql -U postgres -d hoyomusic -f schema_tags_enhanced_utf8.sql
```

### 方法2: 使用pgAdmin (最简单) ⭐⭐⭐

```
1. 打开pgAdmin
2. 连接到hoyomusic数据库
3. 点击 Tools → Query Tool
4. 打开文件: schema_tags_enhanced_utf8.sql
5. 点击执行 (F5)
```

### 方法3: 指定客户端编码

```powershell
# 设置客户端编码为UTF8
$env:PGCLIENTENCODING="UTF8"
psql -U postgres -d hoyomusic -f schema_tags_enhanced_utf8.sql
```

---

## 📝 逐步执行（如果整体执行失败）

如果整体执行出错，可以分步执行：

### Step 1: 创建tag_groups表
```sql
CREATE TABLE IF NOT EXISTS tag_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 2: 扩展tags表
```sql
ALTER TABLE tags 
ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES tag_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
```

### Step 3: 创建索引
```sql
CREATE INDEX IF NOT EXISTS idx_tags_group_id ON tags(group_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tag_groups_name ON tag_groups(name);
```

### Step 4: 创建触发器
```sql
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
```

### Step 5: 插入默认分组
```sql
INSERT INTO tag_groups (name, description, icon, display_order) VALUES
  ('游戏分类', '按游戏系列分类的标签', 'GamepadOutlined', 1),
  ('音乐风格', '音乐风格和类型标签', 'SoundOutlined', 2),
  ('语言', '歌曲语言标签', 'GlobalOutlined', 3),
  ('情感', '音乐情感和氛围标签', 'HeartOutlined', 4),
  ('场景', '适用场景标签', 'EnvironmentOutlined', 5),
  ('其他', '其他分类标签', 'TagsOutlined', 99)
ON CONFLICT (name) DO NOTHING;
```

### Step 6: 创建路径函数
```sql
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
```

---

## ✅ 验证安装

### 检查表是否创建
```sql
-- 检查tag_groups表
SELECT * FROM tag_groups;

-- 应该看到6个默认分组
```

### 检查字段是否添加
```sql
-- 检查tags表结构
\d tags

-- 或者
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tags' 
AND column_name IN ('group_id', 'parent_id', 'display_order', 'icon');
```

### 测试路径函数
```sql
-- 创建一个测试Tag
INSERT INTO tags (name, color) VALUES ('测试Tag', '#1890ff') RETURNING id;

-- 测试路径函数（使用上面返回的ID）
SELECT get_tag_path(1);
```

---

## 🐛 常见错误处理

### 错误1: "关系已存在"
```
ERROR: relation "tag_groups" already exists
```
**解决**: 已经执行过迁移，跳过或使用DROP TABLE（注意数据丢失）

### 错误2: "列已存在"
```
ERROR: column "group_id" of relation "tags" already exists
```
**解决**: 字段已添加，可以忽略此错误

### 错误3: "函数已存在"
```
NOTICE: function get_tag_path(integer) already exists
```
**解决**: 这是正常的，函数会被替换（CREATE OR REPLACE）

---

## 📋 完整执行检查清单

- [ ] 使用UTF-8文件（schema_tags_enhanced_utf8.sql）
- [ ] 连接到正确的数据库（hoyomusic）
- [ ] tag_groups表创建成功
- [ ] tags表字段添加成功
- [ ] 索引创建成功
- [ ] 触发器创建成功
- [ ] 默认分组插入成功（6条记录）
- [ ] get_tag_path函数创建成功
- [ ] 无错误信息

---

## 🎯 快速命令总结

```powershell
# 方法1: PowerShell执行
cd C:\Users\sumi\WebstormProjects\HoYoMusic\backend
$env:PGCLIENTENCODING="UTF8"
psql -U postgres -d hoyomusic -f schema_tags_enhanced_utf8.sql

# 方法2: 直接在psql中执行
psql -U postgres -d hoyomusic
\i C:/Users/sumi/WebstormProjects/HoYoMusic/backend/schema_tags_enhanced_utf8.sql

# 方法3: 使用pgAdmin
# 打开pgAdmin → Query Tool → 打开文件 → 执行
```

---

## 💡 编码问题说明

### 为什么会出现编码错误？
- SQL文件包含中文字符
- Windows默认使用GBK编码
- PostgreSQL数据库使用UTF-8编码
- 字符编码不匹配导致错误

### 解决方案
1. ✅ 使用UTF-8编码的文件（已创建：schema_tags_enhanced_utf8.sql）
2. ✅ 或设置客户端编码：`$env:PGCLIENTENCODING="UTF8"`
3. ✅ 或使用pgAdmin（自动处理编码）

---

**执行完成后，重启后端服务即可使用Tag深度功能！**

```powershell
cd backend
npm run dev
```

---

**维护者**: GitHub Copilot  
**版本**: 1.1 (编码修复版)  
**最后更新**: 2026-02-18

