import React, { useMemo } from 'react';
import { Empty, Tag, Typography } from 'antd';
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
      <section className="music-sources-card mt-5 rounded-3xl border border-white/20 bg-white/[0.12] p-5 shadow-2xl backdrop-blur-md">
        <h3 className="mb-4 text-xl font-bold text-[color:var(--text-primary)]">音乐来源</h3>
        <Empty description="暂无音乐来源信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </section>
    );
  }

  return (
    <section className="music-sources-card mt-5 rounded-3xl border border-white/20 bg-white/[0.12] p-5 shadow-2xl backdrop-blur-md">
      <h3 className="mb-4 text-xl font-bold text-[color:var(--text-primary)]">音乐来源</h3>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {groupedSources.map((group) => (
          <article key={`${group.gameName}-${group.categoryName}`} className="rounded-2xl border border-white/20 bg-white/[0.14] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Tag icon={<ApartmentOutlined />} color="processing" className="!m-0 rounded-full !border-white/25 !bg-cyan-300/20 !px-3 !py-1 !text-[color:var(--text-primary)]">
                {group.gameName}
              </Tag>
              <Tag className="!m-0 rounded-full !border-white/25 !bg-indigo-300/20 !px-3 !py-1 !text-[color:var(--text-primary)]">
                {group.categoryName}
              </Tag>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div key={item.id} className="music-source-path-row rounded-xl border border-white/[0.08] bg-white/[0.05] p-2">
                  {item.path.length > 0 ? (
                    item.path.map((segment, index) => (
                      <React.Fragment key={`${item.id}-${segment}-${index}`}>
                        <Typography.Text className="music-source-segment">
                          {segment}
                        </Typography.Text>
                        {index < item.path.length - 1 && <RightOutlined className="music-source-separator" />}
                      </React.Fragment>
                    ))
                  ) : (
                    <Typography.Text className="text-white/60">{item.node_name}</Typography.Text>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MusicSourcesDisplay;

