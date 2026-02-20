-- Update tag group names to Chinese
-- Execute this AFTER schema_tags_enhanced_en.sql

UPDATE tag_groups SET
  name = 'YouXiFenLei',
  description = 'An you xi xi lie fen lei de biao qian'
WHERE name = 'Game Categories';

UPDATE tag_groups SET
  name = 'YinYueFengGe',
  description = 'Yin yue feng ge he lei xing biao qian'
WHERE name = 'Music Styles';

UPDATE tag_groups SET
  name = 'YuYan',
  description = 'Ge qu yu yan biao qian'
WHERE name = 'Languages';

UPDATE tag_groups SET
  name = 'QingGan',
  description = 'Yin yue qing gan he fen wei biao qian'
WHERE name = 'Emotions';

UPDATE tag_groups SET
  name = 'ChangJing',
  description = 'Shi yong chang jing biao qian'
WHERE name = 'Scenarios';

UPDATE tag_groups SET
  name = 'QiTa',
  description = 'Qi ta fen lei biao qian'
WHERE name = 'Others';

