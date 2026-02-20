import React, { useEffect, useState } from 'react';
import { Layout, List, Input, Avatar, Spin, Empty, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';
import './Artists.css';

const { Header, Content } = Layout;
const { Search } = Input;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Artist {
  id: number;
  name: string;
  track_count: number;
  album_count: number;
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
      const response = await axios.get(`${API_BASE_URL}/artists`, {
        params: { search, limit: 100 }
      });
      if (response.data.success) {
        setArtists(response.data.data.artists);
      }
    } catch (error: any) {
      message.error('Failed to load artists');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    fetchArtists(value);
  };

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
              placeholder="搜索艺术家..."
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
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
          </div>
        ) : artists.length === 0 ? (
          <Empty description="未找到艺术家" />
        ) : (
          <div className="artists-list-container">
            <List
              grid={{
                gutter: 16,
                xs: 1,
                sm: 2,
                md: 3,
                lg: 4,
                xl: 4,
                xxl: 4,
              }}
              dataSource={artists}
              renderItem={(artist) => (
                <List.Item>
                  <div
                    className="artist-card"
                    onClick={() => navigate(`/artists/${artist.id}`)}
                  >
                    <Avatar
                      size={100}
                      icon={<UserOutlined />}
                      style={{
                        backgroundColor: '#1890ff',
                        fontSize: 48,
                      }}
                    />
                    <div className="artist-info">
                      <h3>{artist.name}</h3>
                      <div className="artist-stats">
                        <span>{artist.track_count || 0} 首歌曲</span>
                        <span>{artist.album_count || 0} 张专辑</span>
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default Artists;



