import React, { useEffect, useMemo, useState } from 'react';
import { Layout, Card, Empty, message, Tag as AntTag, Collapse } from 'antd';
import { TagOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTags, getTagGroups, Tag, TagGroup } from '../services/tagService';
import { buildTagPathLookup, getTagPathLabel } from '../utils/tagPath';
import './Tags.css';

const { Content } = Layout;
const { Panel } = Collapse;

// Build a tree of groups
function buildGroupTree(groups: TagGroup[]): TagGroup[] {
  const map: Record<number, TagGroup> = {};
  const roots: TagGroup[] = [];
  groups.forEach(g => { map[g.id] = { ...g, children: [] }; });
  groups.forEach(g => {
    if (g.parent_group_id && map[g.parent_group_id]) {
      map[g.parent_group_id].children!.push(map[g.id]);
    } else {
      roots.push(map[g.id]);
    }
  });
  return roots;
}

function buildTagChildMap(tags: Tag[]): Record<number, Tag[]> {
  const childMap: Record<number, Tag[]> = {};
  tags.forEach((tag) => {
    if (!tag.parent_id) return;
    if (!childMap[tag.parent_id]) childMap[tag.parent_id] = [];
    childMap[tag.parent_id].push(tag);
  });
  return childMap;
}

const Tags: React.FC = () => {
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);

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

  const tree = useMemo(() => buildGroupTree(groups), [groups]);
  const tagPathLookup = useMemo(() => buildTagPathLookup(tags, groups), [tags, groups]);
  const childTagMap = useMemo(() => buildTagChildMap(tags), [tags]);
  const tagIdSet = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);

  const rootTags = useMemo(
    () => tags.filter((tag) => !tag.parent_id || !tagIdSet.has(tag.parent_id)),
    [tags, tagIdSet]
  );

  const groupedRootTagMap = useMemo(() => {
    const map: Record<string, Tag[]> = {};
    rootTags.forEach((tag) => {
      const key = tag.group_id ? String(tag.group_id) : 'ungrouped';
      if (!map[key]) map[key] = [];
      map[key].push(tag);
    });
    return map;
  }, [rootTags]);

  const ungroupedTags = groupedRootTagMap.ungrouped || [];

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
        <h3 className="tag-name">{getTagPathLabel(tag, tagPathLookup)}</h3>
        <div className="tag-stats">
          <span>{tag.track_count || 0} 首</span>
        </div>
      </div>
    </Card>
  );

  const renderTagTree = (tag: Tag, level = 0): React.ReactNode => {
    const children = childTagMap[tag.id] || [];

    return (
      <div key={tag.id} className="tag-tree-node" style={{ marginLeft: level * 16 }}>
        {renderTagCard(tag)}
        {children.length > 0 && (
          <div className="tag-tree-children">
            {children.map((child) => renderTagTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const hasGroupContent = (group: TagGroup): boolean => {
    const own = (groupedRootTagMap[String(group.id)] || []).length > 0;
    if (own) return true;
    return (group.children || []).some((child) => hasGroupContent(child));
  };

  const renderSubGroup = (group: TagGroup, depth = 0): React.ReactNode => {
    const groupRootTags = groupedRootTagMap[String(group.id)] || [];
    const hasContent = hasGroupContent(group);
    if (!hasContent) return null;

    return (
      <div key={group.id} className="tag-subgroup" style={{ marginLeft: depth * 8 }}>
        <div className="tag-subgroup-header">
          <AppstoreOutlined style={{ marginRight: 6 }} />
          {group.icon && <span style={{ marginRight: 6 }}>{group.icon}</span>}
          <strong>{group.name}</strong>
          <AntTag style={{ marginLeft: 8, fontSize: 11 }} color="purple">{group.tag_count || 0}</AntTag>
        </div>

        {groupRootTags.length > 0 && (
          <div className="tag-tree-list" style={{ marginBottom: (group.children || []).length > 0 ? 16 : 0 }}>
            {groupRootTags.map((tag) => renderTagTree(tag))}
          </div>
        )}

        {(group.children || []).map((child) => renderSubGroup(child, depth + 1))}
      </div>
    );
  };

  const renderGroup = (group: TagGroup, depth = 0): React.ReactNode => {
    const groupRootTags = groupedRootTagMap[String(group.id)] || [];
    const hasContent = hasGroupContent(group);
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
        {groupRootTags.length > 0 && (
          <div className="tag-tree-list" style={{ marginBottom: (group.children || []).length > 0 ? 16 : 0 }}>
            {groupRootTags.map((tag) => renderTagTree(tag))}
          </div>
        )}
        {(group.children || []).map((child) => renderSubGroup(child, 0))}
      </Panel>
    );
  };

  return (
    <Layout className="tags-layout">
      <Content className="tags-content">
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
                <div className="tag-tree-list">
                  {ungroupedTags.map((tag) => renderTagTree(tag))}
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
