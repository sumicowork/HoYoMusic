import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Space, Statistic, Typography, Button } from 'antd';
import { HeartFilled, UnorderedListOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import favoriteService from '../services/favoriteService';
import playlistService from '../services/playlistService';

const { Title, Text } = Typography;

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [favoriteData, playlists] = await Promise.all([
          favoriteService.getFavorites(1, 1),
          playlistService.getPlaylists(),
        ]);
        if (!mounted) return;
        setFavoriteCount(favoriteData.pagination?.total || 0);
        setPlaylistCount(playlists.length);
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
        <Text type="secondary">查看你的收藏和歌单概览</Text>
      </Space>

      <Card loading={loading}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Text>当前账号：{user?.username || '未知用户'}</Text>
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

          <Space wrap>
            <Button type="primary" icon={<HeartFilled />} onClick={() => navigate('/favorites')}>
              打开我的收藏
            </Button>
            <Button icon={<UnorderedListOutlined />} onClick={() => navigate('/playlists')}>
              打开我的歌单
            </Button>
            <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default Profile;

