import React, { useMemo } from 'react';
import { Card, Empty, Space, Tag, Typography } from 'antd';
import { ApartmentOutlined, RightOutlined } from '@ant-design/icons';
import type { TrackMusicSourceItem } from '../types';
import './MusicSourcesDisplay.css';

interface MusicSourcesDisplayProps {
  sources: TrackMusicSourceItem[];
}

const MusicSourcesDisplay: React.FC<MusicSourcesDisplayProps> = ({ sources }) => {
  const groupedSources = useMemo(() => {
    const groups = new Map<string, TrackMusicSourceItem[]>();
    for (const source of sources) {
      const key = `${source.game_name || '未知游戏'}__${source.category_name}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(source);
    }

    return Array.from(groups.entries()).map(([key, items]) => {
      const [gameName, categoryName] = key.split('__');
      return {
        gameName,
        categoryName,
        items: [...items].sort((a, b) => a.display_order - b.display_order || a.id - b.id),
      };
    });
  }, [sources]);

  if (!sources || sources.length === 0) {
    return (
      <Card className="music-sources-card" title="音乐来源">
        <Empty description="暂无音乐来源信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <Card className="music-sources-card" title="音乐来源">
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {groupedSources.map((group) => (
          <div key={`${group.gameName}-${group.categoryName}`} className="music-source-group">
            <Space wrap>
              <Tag icon={<ApartmentOutlined />} color="processing">
                {group.gameName}
              </Tag>
              <Tag color="purple">{group.categoryName}</Tag>
            </Space>
            <div className="music-source-path-list">
              {group.items.map((item) => (
                <div key={item.id} className="music-source-path-row">
                  {item.path.length > 0 ? (
                    item.path.map((segment, index) => (
                      <React.Fragment key={`${item.id}-${segment}-${index}`}>
                        <Typography.Text className="music-source-segment">{segment}</Typography.Text>
                        {index < item.path.length - 1 && <RightOutlined className="music-source-separator" />}
                      </React.Fragment>
                    ))
                  ) : (
                    <Typography.Text type="secondary">{item.node_name}</Typography.Text>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Space>
    </Card>
  );
};

export default MusicSourcesDisplay;

