import React, { useEffect, useState } from 'react';
import { Layout, List, Input, Avatar, Skeleton, Empty, message, Row, Col, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { artistService, Artist } from '../services/artistService';
import './Artists.css';

const { Content } = Layout;
const { Search } = Input;

const Artists: React.FC = () => {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchArtists();
  }, []);

  const fetchArtists = async (search = '') => {
    setLoading(true);
    try {
      const artists = await artistService.getArtists({ search, limit: 1000 });
      setArtists(artists);
    } catch (error: any) {
      message.error('加载创作者列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    fetchArtists(value);
  };

  const renderItem = (artist: Artist) => (
    <List.Item>
      <div
        className="artist-card"
        onClick={() => navigate(`/artists/${artist.id}`)}
      >
        <Avatar
          size={100}
          icon={<UserOutlined />}
          style={{ backgroundColor: '#667eea', fontSize: 48 }}
        />
        <div className="artist-info">
          <h3>{artist.name}</h3>
          <div className="artist-stats">
            <span>{artist.track_count || 0} 首歌曲</span>
            <span>{artist.album_count || 0} 张专辑</span>
          </div>
          {artist.roles && artist.roles.length > 0 && (
            <div className="artist-roles">
              {artist.roles.slice(0, 3).map(r => (
                <Tag key={r} color="purple" style={{ fontSize: 10, margin: 0 }}>{r}</Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </List.Item>
  );

  return (
    <Layout className="artists-layout">
      <Content className="artists-content">
        <div className="artists-toolbar">
          <Search
            placeholder="搜索创作者..."
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ maxWidth: 400 }}
          />
        </div>
        {loading ? (
          <Row gutter={[16, 16]}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Col key={i} xs={24} sm={12} md={8} lg={6}>
                <Card>
                  <Skeleton active avatar={{ size: 80, shape: 'circle' }} paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : artists.length === 0 ? (
          <Empty description="未找到创作者" />
        ) : (
          <div className="artists-list-container">
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 4 }}
              dataSource={artists}
              renderItem={renderItem}
            />
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default Artists;

