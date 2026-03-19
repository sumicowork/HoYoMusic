import React, { useEffect, useState } from 'react';
import { Layout, Card, Empty, message, Row, Col, Tag as AntTag, Collapse } from 'antd';
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

  const renderTagCard = (tag: Tag) => (
    <Col xs={24} sm={12} md={8} lg={8} xl={6} xxl={4} key={tag.id} className="tag-card-col">
      <Card
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
    </Col>
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
          <Row gutter={[12, 12]} style={{ marginBottom: (group.children || []).length > 0 ? 16 : 0 }}>
            {group.tags!.map(renderTagCard)}
          </Row>
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
              <Row gutter={[12, 12]}>
                {(child.tags || []).map(renderTagCard)}
              </Row>
              {(child.children || []).map(sub => renderGroup(sub, depth + 2))}
            </div>
          );
        })}
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
                <Row gutter={[12, 12]}>
                  {ungroupedTags.map(renderTagCard)}
                </Row>
              </div>
            )}
          </>
        )}
      </Content>
    </Layout>
  );
};

export default Tags;
