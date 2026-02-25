import React, { useEffect, useState } from 'react';
import { Layout, List, Input, Avatar, Skeleton, Empty, message, Row, Col, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { IS_STATIC } from '../services/api';
import * as staticData from '../services/staticDataService';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';
import './Artists.css';

const { Header, Content } = Layout;
const { Search } = Input;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Artist {
  name: string;
  track_count: number;
  album_count: number;
  roles: string[];
}

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
      if (IS_STATIC) {
        const data = await staticData.getArtists(1, 100, search);
        setArtists(data.artists);
      } else {
        const response = await axios.get(`${API_BASE_URL}/artists`, {
          params: { search, limit: 100 }
        });
        if (response.data.success) {
          setArtists(response.data.data.artists);
        }
      }
    } catch (error: any) {
      message.error('加载艺术家列表失败');
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
        onClick={() => navigate(`/artists/${encodeURIComponent(artist.name)}`)}
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
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
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
      <Header className="artists-header">
        <div className="header-content">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            🎵 HoYoMusic
          </h1>
          <div className="header-actions">
            <ThemeToggle />
            <Search
              placeholder="搜索创作者..."
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              style={{ width: 300, marginLeft: 16, marginRight: 16 }}
            />
          </div>
        </div>
      </Header>

      <Content className="artists-content">
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

