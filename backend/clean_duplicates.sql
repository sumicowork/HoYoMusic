-- 清理重复的曲目数据
-- 警告：这会删除重复的记录，只保留最新的一条

-- 1. 首先查看重复的曲目
SELECT
    title,
    file_path,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::TEXT, ', ') as ids
FROM tracks
GROUP BY title, file_path
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. 删除重复项（保留每组中 ID 最大的，即最新的）
DELETE FROM tracks a
USING tracks b
WHERE a.id < b.id
AND a.title = b.title
AND a.file_path = b.file_path;

-- 3. 验证清理结果
SELECT
    COUNT(*) as total_tracks,
    COUNT(DISTINCT title) as unique_titles,
    COUNT(DISTINCT file_path) as unique_files
FROM tracks;

-- 4. 查看清理后的曲目列表
SELECT id, title, file_path, created_at
FROM tracks
ORDER BY created_at DESC
LIMIT 20;

