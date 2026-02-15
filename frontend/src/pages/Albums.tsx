import React, { useEffect, useState } from 'react';
import { Layout, Card, Input, Row, Col, Spin, Empty, Tag, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, LoginOutlined, SoundOutlined, HomeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import ThemeToggle from '../components/ThemeToggle';
import './Albums.css';

const { Header, Content } = Layout;
const { Search } = Input;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  track_count: number;
  total_duration: number;
}

const Albums: React.FC = () => {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async (search = '') => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/albums`, {
        params: { search, limit: 100 }
      });
      if (response.data.success) {
        setAlbums(response.data.data.albums);
      }
    } catch (error: any) {
      message.error('Failed to load albums');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    fetchAlbums(value);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };


  return (
    <Layout className="albums-layout">
      <Header className="albums-header">
        <div className="header-content">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            🎵 HoYoMusic
          </h1>
          <div className="header-actions">
            <ThemeToggle />
            <Search
              placeholder="搜索专辑..."
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              style={{ width: 300, marginRight: 16, marginLeft: 16 }}
            />
            <Space size="middle">
              <Tag
                color="green"
                style={{ cursor: 'pointer', padding: '6px 16px', fontSize: '14px', fontWeight: 500 }}
                onClick={() => navigate('/')}
              >
                <HomeOutlined /> 主页
              </Tag>
              <Tag
                color="purple"
                style={{ cursor: 'pointer', padding: '6px 16px', fontSize: '14px', fontWeight: 500 }}
                onClick={() => navigate('/artists')}
              >
                <SoundOutlined /> 艺术家
              </Tag>
              <Tag
                color="default"
                style={{ cursor: 'pointer', padding: '6px 16px', fontSize: '14px', fontWeight: 500 }}
                onClick={() => navigate('/admin/login')}
              >
                <LoginOutlined /> 管理
              </Tag>
            </Space>
          </div>
        </div>
      </Header>

      <Content className="albums-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
          </div>
        ) : albums.length === 0 ? (
          <Empty description="未找到专辑" />
        ) : (
          <Row gutter={[24, 24]}>
            {albums.map((album) => (
              <Col key={album.id} xs={24} sm={12} md={8} lg={6} xl={6} xxl={6}>
                <Card
                  hoverable
                  className="album-card"
                  onClick={() => navigate(`/albums/${album.id}`)}
                  cover={
                    <div className="album-cover-wrapper">
                      <img
                        alt={album.title}
                        src={getCoverUrl(album.cover_path, API_BASE_URL.replace('/api', ''))}
                        onError={handleImageError}
                      />
                    </div>
                  }
                >
                  <Card.Meta
                    title={album.title}
                    description={
                      <div className="album-info">
                        <div>{album.track_count || 0} 首</div>
                        {album.total_duration && (
                          <div>{formatDuration(album.total_duration)}</div>
                        )}
                        {album.release_date && (
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {new Date(album.release_date).getFullYear()}
                          </div>
                        )}
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  );
};

export default Albums;





