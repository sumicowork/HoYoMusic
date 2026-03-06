import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Row, Col, Spin, Empty, message, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { gameService } from '../services/gameService';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import './GameDetail.css';

const { Content } = Layout;

interface Game {
  id: number;
  name: string;
  name_en: string;
  description: string;
  album_count: number;
}

interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  track_count: number;
  total_duration: number;
}

const GameDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchGameDetails();
    }
  }, [id]);

  const fetchGameDetails = async () => {
    try {
      const data = await gameService.getGameById(parseInt(id!));
      setGame(data.game);
      setAlbums(data.albums);
    } catch (error: any) {
      message.error('加载游戏详情失败');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (!game) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            Back to Home
          </Button>
          <div style={{ marginTop: 24, textAlign: 'center' }}>Game not found</div>
        </Content>
      </Layout>
    );
  }

  const getGameClass = () => {
    if (!game) return '';
    const name = game.name;
    if (name === '原神') return 'genshin-bg';
    if (name === '崩坏：星穹铁道') return 'starrail-bg';
    if (name === '绝区零') return 'zzz-bg';
    if (name === '崩坏3') return 'honkai3-bg';
    if (name === '未定事件簿') return 'tears-bg';
    if (name === '崩坏因缘精灵') return 'nexus-bg';
    if (name === '星布谷地') return 'petit-bg';
    return '';
  };

  return (
    <Layout className={`game-detail-layout ${getGameClass()}`}>

      <Content className="game-detail-content" style={{ background: 'transparent' }}>

        {albums.length === 0 ? (
          <Empty
            description={
              <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px' }}>
                该游戏暂无专辑
              </span>
            }
          />
        ) : (
          <Row gutter={[28, 36]}>
            {albums.map((album) => (
              <Col key={album.id} xs={12} sm={12} md={8} lg={6} xl={6} xxl={6}>
                <Card
                  hoverable
                  className="album-card"
                  onClick={() => navigate(`/albums/${album.id}`)}
                  cover={
                    <div className="album-cover-wrapper">
                      <img
                        alt={album.title}
                        src={getCoverUrl(album.cover_path, undefined, true)}
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
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
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

export default GameDetail;

