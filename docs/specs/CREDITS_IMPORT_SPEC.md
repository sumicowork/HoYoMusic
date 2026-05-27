# Credits 批量导入数据文件规范

**版本**: 1.0  
**日期**: 2026-03-01

---

## 概述

Credits 导入文件使用 **JSON** 格式，通过 **专辑名 + 歌曲标题** 联合匹配数据库中的曲目，批量写入 `track_credits` 表。

---

## 文件结构

```json
{
  "version": "1.0",
  "conflict_mode": "append",
  "tracks": [
    {
      "album": "专辑名称",
      "track": "歌曲标题",
      "credits": [
        { "key": "作曲", "value": "崎元仁", "order": 0 },
        { "key": "编曲", "value": "崎元仁", "order": 1 },
        { "key": "演唱", "value": "陈致逸", "order": 2 }
      ]
    }
  ]
}
```

---

## 字段说明

### 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | `string` | 否 | 规范版本号，当前为 `"1.0"` |
| `conflict_mode` | `string` | 否 | 全局冲突处理策略，默认 `"append"`。详见下方说明 |
| `tracks` | `array` | **是** | 曲目 credits 列表，至少含一项 |

### `tracks[].` 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `album` | `string` | **是** | 专辑标题，与数据库 `albums.title` 大小写不敏感匹配 |
| `track` | `string` | **是** | 歌曲标题，与数据库 `tracks.title` 大小写不敏感匹配 |
| `conflict_mode` | `string` | 否 | 覆盖顶层 `conflict_mode`，仅对本条目生效 |
| `credits` | `array` | **是** | Credits 条目列表，至少含一项 |

### `tracks[].credits[].` 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | **是** | Credit 键名，如 `作曲`、`编曲`、`混音`、`COMPOSER` 等 |
| `value` | `string` | **是** | Credit 值，如人名或机构名 |
| `order` | `number` | 否 | 显示顺序，默认按数组索引自动递增（从 0 开始） |

---

## `conflict_mode` 说明

| 值 | 行为 |
|----|------|
| `append` | **（默认）** 直接追加，不检查重复 |
| `overwrite` | 先删除该曲目所有已有 credits，再写入新数据 |
| `skip` | 若该曲目已有任意 credits 记录，则跳过整条不写入 |

---

## 匹配规则

1. 通过 `album`（专辑名）+ `track`（歌曲标题）联合定位数据库曲目。
2. 匹配时**忽略大小写**，但需完全一致（不做模糊匹配）。
3. 若同一专辑下存在两首同名曲目，该条目状态为 `ambiguous`，不写入，需在文件中修正后重试。
4. 若专辑或曲目在数据库中不存在，该条目状态为 `not_found`，跳过并在报告中提示。

---

## 导入结果报告

每条 `tracks` 项会返回以下状态之一：

| 状态 | 说明 |
|------|------|
| `imported` | 成功写入 |
| `skipped` | `conflict_mode: skip` 且已有 credits，跳过 |
| `not_found` | 专辑名或歌曲标题未匹配到数据库记录 |
| `ambiguous` | 同专辑下找到多首同名曲目，无法确定目标 |
| `error` | 写入过程发生错误 |

---

## 完整示例

```json
{
  "version": "1.0",
  "conflict_mode": "append",
  "tracks": [
    {
      "album": "原神 游戏原声带 第一卷",
      "track": "Genshin Impact Main Theme",
      "credits": [
        { "key": "作曲", "value": "陈致逸 (HOYO-MiX)" },
        { "key": "编曲", "value": "陈致逸 (HOYO-MiX)" },
        { "key": "制作人", "value": "陈致逸 (HOYO-MiX)" }
      ]
    },
    {
      "album": "崩坏：星穹铁道 游戏原声带",
      "track": "Trailblaze",
      "conflict_mode": "overwrite",
      "credits": [
        { "key": "作曲", "value": "HOYO-MiX" },
        { "key": "编曲", "value": "HOYO-MiX" },
        { "key": "演唱", "value": "Jonathan Roy" },
        { "key": "混音", "value": "HOYO-MiX", "order": 10 }
      ]
    },
    {
      "album": "绝区零 游戏原声带",
      "track": "New Eridu City Theme",
      "conflict_mode": "skip",
      "credits": [
        { "key": "作曲", "value": "HOYO-MiX" }
      ]
    }
  ]
}
```

---

## 常用 Credit Key 参考

| Key | 说明 |
|-----|------|
| `作曲` / `COMPOSER` | 作曲 |
| `编曲` / `ARRANGER` | 编曲 |
| `作词` / `LYRICIST` | 作词 |
| `演唱` / `PERFORMER` | 演唱/演奏 |
| `制作人` / `PRODUCER` | 音乐制作人 |
| `混音` / `MIXER` | 混音 |
| `母带` / `MASTERING` | 母带处理 |
| `录音` / `RECORDIST` | 录音师 |
| `弦乐编排` | 弦乐编排 |
| `钢琴` | 钢琴演奏者 |

---

## 注意事项

- 文件编码必须为 **UTF-8**。
- 单次导入文件中 `tracks` 数量不限，但建议每文件不超过 **500 条**。
- 导入为**原子性事务**：单条曲目的写入失败不影响其他条目。
- 导入前建议先用「预览」功能确认匹配结果再提交。

---

## 导出兼容性

- 后台管理中的「导出 Credits」会生成与本规范完全一致的 JSON 文件（`version`、`conflict_mode`、`tracks[]` 结构相同）。
- 导出支持按专辑批量选择；仅导出已存在 credits 的曲目条目（避免生成无法导入的空 `credits`）。
- 导出的文件可直接用于「批量导入 Credits」功能。

