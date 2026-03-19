import React, { useEffect, useRef, useState } from 'react';
import { Layout, Card, Empty, message, Tag as AntTag, Collapse } from 'antd';
import { TagOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTags, getTagGroups, Tag, TagGroup } from '../services/tagService';
import './Tags.css';

const { Content } = Layout;
const { Panel } = Collapse;

// Build a tree of groups and attach tags
function buildGroupTree(groups: TagGroup[], tags: Tag[]): TagGroup[] {
  const map: Record<number, TagGroup> = {};
  const roots: TagGroup[] = [];
  groups.forEach(g => { map[g.id] = { ...g, children: [], tags: [] }; });
  groups.forEach(g => {
    if (g.parent_group_id && map[g.parent_group_id]) {
      map[g.parent_group_id].children!.push(map[g.id]);
    } else {
      roots.push(map[g.id]);
    }
  });
  tags.forEach(t => {
    if (t.group_id && map[t.group_id]) {
      map[t.group_id].tags!.push(t);
    }
  });
  return roots;
}

const Tags: React.FC = () => {
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const showGridDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugGrid') === '1';
  const [gridDebugText, setGridDebugText] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tagsData, groupsData] = await Promise.all([getTags(), getTagGroups()]);
      setTags(tagsData);
      setGroups(groupsData);
    } catch {
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  const ungroupedTags = tags.filter(t => !t.group_id);
  const tree = buildGroupTree(groups, tags);

  useEffect(() => {
    if (!showGridDebug) return;

    const updateDebugText = () => {
      const contentEl = contentRef.current;
      const gridEl = contentEl?.querySelector('.tag-grid') as HTMLElement | null;
      if (!contentEl || !gridEl) {
        setGridDebugText('grid not mounted');
        return;
      }

      const contentWidth = Math.round(contentEl.getBoundingClientRect().width);
      const gridWidth = Math.round(gridEl.getBoundingClientRect().width);
      const gridTemplate = window.getComputedStyle(gridEl).gridTemplateColumns;
      const cols = gridTemplate.split(' ').filter(Boolean).length;
      const innerWidth = Math.round(window.innerWidth);
      const clientWidth = Math.round(document.documentElement.clientWidth);
      const visualWidth = Math.round(window.visualViewport?.width || 0);
      const dpr = window.devicePixelRatio || 1;
      const mq560 = window.matchMedia('(max-width: 560px)').matches ? '1' : '0';
      const mq768 = window.matchMedia('(max-width: 768px)').matches ? '1' : '0';

      setGridDebugText(
        `vw:${innerWidth}/${clientWidth}/${visualWidth}px dpr:${dpr.toFixed(2)} mq560:${mq560} mq768:${mq768} | content:${contentWidth}px grid:${gridWidth}px cols:${cols} template:${gridTemplate}`
      );
    };

    updateDebugText();
    window.addEventListener('resize', updateDebugText);
    const ro = new ResizeObserver(updateDebugText);
    if (contentRef.current) ro.observe(contentRef.current);

    return () => {
      window.removeEventListener('resize', updateDebugText);
      ro.disconnect();
    };
  }, [showGridDebug, loading, tags.length, groups.length]);

  const renderTagCard = (tag: Tag) => (
    <Card
      key={tag.id}
      hoverable
      className="tag-card"
      onClick={() => navigate(`/tags/${tag.id}`)}
      style={{ borderLeft: `4px solid ${tag.color}` }}
    >
      <div className="tag-card-content">
        <div className="tag-icon" style={{ backgroundColor: tag.color }}>
          <TagOutlined style={{ fontSize: 20, color: '#fff' }} />
        </div>
        <h3 className="tag-name">{tag.name}</h3>
        <div className="tag-stats">
          <span>{tag.track_count || 0} 首</span>
        </div>
      </div>
    </Card>
  );

  const renderGroup = (group: TagGroup, depth = 0): React.ReactNode => {
    const hasContent = (group.tags?.length ?? 0) > 0 || (group.children?.length ?? 0) > 0;
    if (!hasContent) return null;
    return (
      <Panel
        key={group.id}
        header={
          <span style={{ paddingLeft: depth * 16, fontWeight: 700, fontSize: 15 }}>
            {group.icon && <span style={{ marginRight: 8 }}>{group.icon}</span>}
            {group.name}
            <AntTag style={{ marginLeft: 8, fontSize: 11 }} color="blue">{group.tag_count || 0} 个标签</AntTag>
          </span>
        }
      >
        {(group.tags || []).length > 0 && (
          <div className="tag-grid" style={{ marginBottom: (group.children || []).length > 0 ? 16 : 0 }}>
            {group.tags!.map(renderTagCard)}
          </div>
        )}
        {(group.children || []).map(child => {
          const childHasContent = (child.tags?.length ?? 0) > 0 || (child.children?.length ?? 0) > 0;
          if (!childHasContent) return null;
          return (
            <div key={child.id} className="tag-subgroup">
              <div className="tag-subgroup-header">
                <AppstoreOutlined style={{ marginRight: 6 }} />
                {child.icon && <span style={{ marginRight: 6 }}>{child.icon}</span>}
                <strong>{child.name}</strong>
                <AntTag style={{ marginLeft: 8, fontSize: 11 }} color="purple">{child.tag_count || 0}</AntTag>
              </div>
              <div className="tag-grid">
                {(child.tags || []).map(renderTagCard)}
              </div>
              {(child.children || []).map(sub => renderGroup(sub, depth + 2))}
            </div>
          );
        })}
      </Panel>
    );
  };

  return (
    <Layout className="tags-layout">
      <Content className="tags-content" ref={contentRef}>
        {showGridDebug && (
          <div className="tag-grid-debug" role="status" aria-live="polite">
            {gridDebugText || 'debug ready'}
          </div>
        )}
        {loading ? (
          <div className="loading-container"><p>加载中...</p></div>
        ) : tags.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有标签" style={{ marginTop: 60 }} />
        ) : (
          <>
            {tree.length > 0 && (
              <Collapse
                defaultActiveKey={tree.map(g => g.id)}
                className="tags-collapse"
                ghost
              >
                {tree.map(group => renderGroup(group, 0))}
              </Collapse>
            )}
            {ungroupedTags.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 className="tags-section-title"><TagOutlined /> 其他标签</h3>
                <div className="tag-grid">
                  {ungroupedTags.map(renderTagCard)}
                </div>
              </div>
            )}
          </>
        )}
      </Content>
    </Layout>
  );
};

export default Tags;
