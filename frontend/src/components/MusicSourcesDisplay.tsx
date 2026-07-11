import React, { useMemo } from 'react';
import { Empty, Tag, Typography } from 'antd';
import { ApartmentOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { TrackMusicSourceItem } from '../types';
import './MusicSourcesDisplay.css';

interface MusicSourcesDisplayProps {
  sources: TrackMusicSourceItem[];
}

const MusicSourcesDisplay: React.FC<MusicSourcesDisplayProps> = ({ sources }) => {
  const navigate = useNavigate();
  const groupedSources = useMemo(() => {
    const groups = new Map<string, { gameId: number | null; gameName: string; categoryName: string; items: TrackMusicSourceItem[] }>();
    for (const source of sources) {
      const gameName = source.game_name || '未知游戏';
      const key = `${gameName}__${source.category_name}`;
      if (!groups.has(key)) {
        groups.set(key, {
          gameId: source.game_id ?? null,
          gameName,
          categoryName: source.category_name,
          items: [],
        });
      }
      groups.get(key)!.items.push(source);
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.display_order - b.display_order || a.id - b.id),
    }));
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
              <Tag
                icon={<ApartmentOutlined />}
                color="processing"
                onClick={group.gameId ? () => navigate(`/games/${group.gameId}`) : undefined}
                className={`!m-0 rounded-full !border-white/25 !bg-cyan-300/20 !px-3 !py-1 !text-[color:var(--text-primary)]${group.gameId ? ' cursor-pointer transition-colors hover:!bg-cyan-300/40' : ''}`}
              >
                {group.gameName}
              </Tag>
              <Tag className="!m-0 rounded-full !border-white/25 !bg-indigo-300/20 !px-3 !py-1 !text-[color:var(--text-primary)]">
                {group.categoryName}
              </Tag>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => {
                const canJump = Boolean(group.gameId && item.node_id);
                const jump = canJump
                  ? () => navigate(`/games/${group.gameId}?tab=sources&node=${item.node_id}`)
                  : undefined;
                return (
                  <div
                    key={item.id}
                    onClick={jump}
                    role={canJump ? 'button' : undefined}
                    tabIndex={canJump ? 0 : undefined}
                    onKeyDown={canJump ? (e) => { if (e.key === 'Enter') jump?.(); } : undefined}
                    title={canJump ? '在游戏页查看此场景' : undefined}
                    className={`music-source-path-row rounded-xl border border-white/[0.08] bg-white/[0.05] p-2${canJump ? ' cursor-pointer transition-colors hover:!bg-white/[0.12]' : ''}`}
                  >
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
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MusicSourcesDisplay;

