-- Update tag group names to Chinese
-- Execute this AFTER schema_tags_enhanced_en.sql (only needed if you ran the EN version first)

UPDATE tag_groups SET name = '游戏分类', description = '按游戏系列分类的标签' WHERE name = 'Game Categories';
UPDATE tag_groups SET name = '音乐风格', description = '音乐风格和类型标签'   WHERE name = 'Music Styles';
UPDATE tag_groups SET name = '语言',     description = '歌曲语言标签'         WHERE name = 'Languages';
UPDATE tag_groups SET name = '情感',     description = '音乐情感和氛围标签'   WHERE name = 'Emotions';
UPDATE tag_groups SET name = '场景',     description = '适用场景标签'         WHERE name = 'Scenarios';
UPDATE tag_groups SET name = '其他',     description = '其他分类标签'         WHERE name = 'Others';
