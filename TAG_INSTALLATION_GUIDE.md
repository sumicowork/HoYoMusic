# Tag深度功能 - 安装指南

**日期**: 2026-02-18  
**功能**: Tag分组 + 层级结构  

---

## 🚀 快速开始

### Step 1: 数据库迁移

打开PostgreSQL命令行或pgAdmin，执行以下SQL脚本：

```bash
# Windows PowerShell
cd C:\Users\sumi\WebstormProjects\HoYoMusic\backend

# 如果有psql命令行工具
psql -U postgres -d hoyomusic -f schema_tags_enhanced.sql

# 或者手动复制SQL内容到pgAdmin中执行
```

**SQL脚本位置**: `backend/schema_tags_enhanced.sql`

---

## 📝 数据库变更内容

### 1. 新建表：tag_groups
```sql
CREATE TABLE tag_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. tags表新增字段
```sql
ALTER TABLE tags ADD COLUMN:
- group_id INTEGER           -- 所属分组
- parent_id INTEGER          -- 父级Tag
- display_order INTEGER      -- 显示顺序
- icon VARCHAR(50)           -- Tag图标
```

### 3. 预设数据
自动插入6个默认Tag分组：
- 游戏分类
- 音乐风格
- 语言
- 情感
- 场景
- 其他

---

## ✅ 验证安装

### 方法1: SQL查询
```sql
-- 检查tag_groups表是否创建
SELECT * FROM tag_groups;

-- 检查tags表新字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tags' 
AND column_name IN ('group_id', 'parent_id', 'display_order', 'icon');

-- 测试get_tag_path函数
SELECT get_tag_path(1);
```

### 方法2: API测试
```bash
# 测试Tag Groups API
curl http://localhost:3000/api/tags/groups/all

# 测试Tags API（应该包含group_name等新字段）
curl http://localhost:3000/api/tags
```

---

## 🔧 后端服务重启

```bash
# 进入后端目录
cd C:\Users\sumi\WebstormProjects\HoYoMusic\backend

# 重启开发服务器
npm run dev
```

---

## 🎯 使用示例

### 创建带分组的Tag

#### API请求
```bash
POST http://localhost:3000/api/tags
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "原神",
  "color": "#1890ff",
  "description": "米哈游制作的开放世界冒险游戏",
  "group_id": 1,    // 游戏分类
  "icon": "GamepadOutlined",
  "display_order": 1
}
```

### 创建子Tag

```bash
POST http://localhost:3000/api/tags
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "蒙德",
  "color": "#52c41a",
  "description": "风之国度",
  "group_id": 1,
  "parent_id": 3,   // 原神的ID
  "icon": "HomeOutlined",
  "display_order": 1
}
```

### 查询Tag详情（含层级）

```bash
GET http://localhost:3000/api/tags/3

Response:
{
  "id": 3,
  "name": "原神",
  "group_name": "游戏分类",
  "parent_name": null,
  "full_path": "原神",        // 完整路径
  "children_count": 3,         // 子Tag数量
  "children": [                // 子Tag列表
    {
      "id": 4,
      "name": "蒙德",
      "track_count": 15
    }
  ],
  "tracks": [...]              // 曲目列表
}
```

---

## 🎨 前端开发（待完成）

### 需要创建的组件

1. **TagGroupManager.tsx**
   - Tag分组CRUD管理
   - 分组排序
   - 分组图标选择

2. **TagTree.tsx**
   - 树形结构展示
   - 折叠/展开
   - 拖拽排序

3. **TagHierarchySelector.tsx**
   - 层级选择器
   - 父Tag选择下拉框

4. **TagManagement.tsx改进**
   - 集成分组视图
   - 添加树形展示
   - 面包屑导航

### Service层更新

更新 `frontend/src/services/tagService.ts`:
```typescript
// Tag Groups
export const getTagGroups = async (): Promise<TagGroup[]> => {
  const response = await api.get('/tags/groups/all');
  return response.data.data;
};

export const createTagGroup = async (data: any) => {
  const response = await api.post('/tags/groups', data);
  return response.data.data;
};

// Tags with hierarchy
export const getTags = async (): Promise<Tag[]> => {
  // 现在返回包含group_name, parent_name等的完整数据
  const response = await api.get('/tags');
  return response.data.data;
};
```

---

## ⚠️ 注意事项

### 数据完整性
- ✅ 父Tag必须存在才能设置
- ✅ Tag不能是自己的父级
- ✅ 删除Tag会级联删除子Tags
- ✅ 有Tags的分组不能删除

### 性能考虑
- 建议Tag层级不超过3层
- 单个分组下Tag数量建议不超过100个
- 使用索引优化查询性能

### 迁移现有数据
如果已有Tags数据：
```sql
-- 可以批量设置group_id
UPDATE tags 
SET group_id = 6  -- 其他分类
WHERE group_id IS NULL;
```

---

## 🐛 故障排查

### 问题1: SQL执行失败
**原因**: 可能已存在相同表或字段  
**解决**: 检查是否已执行过迁移
```sql
-- 检查表是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'tag_groups';
```

### 问题2: API返回错误
**原因**: 后端服务未重启  
**解决**: 重启后端开发服务器
```bash
cd backend
npm run dev
```

### 问题3: get_tag_path函数不存在
**原因**: SQL函数未创建  
**解决**: 单独执行函数创建部分
```sql
CREATE OR REPLACE FUNCTION get_tag_path(tag_id INTEGER)
RETURNS TEXT AS $$
-- ... (见schema_tags_enhanced.sql)
$$ LANGUAGE plpgsql;
```

---

## 📚 相关文档

- [Tag深度功能详细文档](./TAG_ADVANCED_FEATURES.md)
- [API接口文档](./TAG_ADVANCED_FEATURES.md#后端api)
- [数据库Schema](./schema_tags_enhanced.sql)

---

## ✅ 安装检查清单

- [ ] 数据库Schema执行成功
- [ ] tag_groups表创建成功
- [ ] tags表字段添加成功
- [ ] get_tag_path函数创建成功
- [ ] 默认分组数据插入成功
- [ ] 后端服务重启成功
- [ ] API测试通过
- [ ] 无SQL错误

---

**安装完成后，后端功能即可使用！前端界面开发可稍后进行。**

---

**维护者**: GitHub Copilot  
**文档版本**: 1.0  
**最后更新**: 2026-02-18

