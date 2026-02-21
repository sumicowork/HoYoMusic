import React, { useEffect, useState } from 'react';
import { Card, Empty, message, Row, Col } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTags, Tag } from '../services/tagService';
import './Tags.css';

const Tags: React.FC = () => {
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const data = await getTags();
      setTags(data);
    } catch (error) {
      console.error('获取标签失败:', error);
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (id: number) => {
    navigate(`/tags/${id}`);
  };

  return (
    <div className="tags-container">
      <div className="tags-header">
        <h1>标签浏览</h1>
      </div>

      {loading ? (
        <div className="loading-container">
          <p>加载中...</p>
        </div>
      ) : tags.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有标签"
          style={{ marginTop: 60 }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {tags.map((tag) => (
            <Col xs={24} sm={12} md={8} lg={6} xl={4} key={tag.id}>
              <Card
                hoverable
                className="tag-card"
                onClick={() => handleTagClick(tag.id)}
                style={{ borderLeft: `4px solid ${tag.color}` }}
              >
                <div className="tag-card-content">
                  <div className="tag-icon" style={{ backgroundColor: tag.color }}>
                    <TagOutlined style={{ fontSize: 24, color: '#fff' }} />
                  </div>
                  <h3 className="tag-name">{tag.name}</h3>
                  <p className="tag-description">
                    {tag.description || '暂无描述'}
                  </p>
                  <div className="tag-stats">
                    <span>{tag.track_count || 0} 首歌曲</span>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default Tags;


