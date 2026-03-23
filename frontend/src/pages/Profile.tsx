import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Empty, List, Row, Space, Spin, Statistic, Typography } from 'antd';
import { HeartFilled, LogoutOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import favoriteService from '../services/favoriteService';
import playlistService, { type Playlist } from '../services/playlistService';
import type { Track } from '../types';

const { Title, Text } = Typography;

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { playTrackOnly } = usePlayerStore();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [favoriteTracks, setFavoriteTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [favoriteData, playlists] = await Promise.all([
          favoriteService.getFavorites(1, 8),
          playlistService.getPlaylists(),
        ]);
        if (!mounted) return;
        setFavoriteCount(favoriteData.pagination?.total || 0);
        setFavoriteTracks(favoriteData.tracks || []);
        setPlaylistCount(playlists.length);
        setPlaylists(playlists);
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={4} style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <UserOutlined style={{ marginRight: 8 }} />个人主页
        </Title>
        <Text type="secondary">左侧显示我的喜爱，右侧显示我的歌单</Text>
      </Space>

      <Card>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text>当前账号：{user?.username || '未知用户'}</Text>
            <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
            </Button>
          </Space>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic title="收藏曲目" value={favoriteCount} prefix={<HeartFilled style={{ color: '#ff4d6a' }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic title="自建歌单" value={playlistCount} prefix={<UnorderedListOutlined />} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card title="我的喜爱" loading={loading}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 12 }}><Spin /></div>
                ) : favoriteTracks.length === 0 ? (
                  <Empty description="还没有收藏任何曲目" />
                ) : (
                  <List
                    dataSource={favoriteTracks}
                    renderItem={(track) => (
                      <List.Item
                        actions={[
                          <Button key="play" type="link" size="small" onClick={() => playTrackOnly(track)}>播放</Button>,
                        ]}
                      >
                        <Space direction="vertical" size={0}>
                          <Link to={`/track/${track.id}`}>{track.title}</Link>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {track.album_title || '未分类专辑'}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="我的歌单" loading={loading}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 12 }}><Spin /></div>
                ) : playlists.length === 0 ? (
                  <Empty description="还没有歌单" />
                ) : (
                  <List
                    dataSource={playlists}
                    renderItem={(playlist) => (
                      <List.Item>
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Link to={`/playlists/${playlist.id}`}>{playlist.name}</Link>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {playlist.track_count} 首 · {Math.floor(playlist.total_duration / 60)} 分钟
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Space>
      </Card>
    </div>
  );
};

export default Profile;

