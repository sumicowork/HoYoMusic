import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout, Table, Button, Space, Tag, Skeleton, Avatar, Tabs, Card, Row, Col, message, Tooltip, Grid, List, Typography } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import './ArtistDetail.css';

const { Content } = Layout;
const { TabPane } = Tabs;
const { useBreakpoint } = Grid;
const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

interface Artist {
  id: number;
  name: string;
  track_count: number;
  album_count: number;
  roles: string[];
  aliases?: string[];
  avatar_path?: string | null;
}

interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  track_count: number;
}

interface GameInfo {
  id: number;
  name: string;
  name_en: string;
  cover_path: string;
}

const ArtistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();  // actually the person's name (encoded)
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { play, setPlaylist, playTrackOnly } = usePlayerStore();

  useEffect(() => {
    if (id) fetchArtistDetails();
  }, [id]);

  const fetchArtistDetails = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/artists/${id}`);
      if (response.data.success) {
        setArtist(response.data.data.artist);
        setTracks(response.data.data.tracks);
        setAlbums(response.data.data.albums);
        if (response.data.data.games) setGames(response.data.data.games);
      }
    } catch (error: any) {
      message.error('加载创作者详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track: Track) => { playTrackOnly(track); };
  const handlePlayAll = () => {
    if (tracks.length > 0) { setPlaylist(tracks); play(tracks[0]); }
  };
  const handleDownload = (track: Track) => {
    window.open(trackService.getDownloadUrlPublic(track.id), '_blank');
  };
  const formatDuration = (seconds: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const trackColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Track) => (
        <a onClick={() => navigate(`/track/${record.id}`)} style={{ color: '#1890ff', cursor: 'pointer' }}>
          {title}
        </a>
      ),
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album',
      render: (album: string, record: Track) => {
        if (!album) return '-';
        if (!record.album_id) return album;
        return <Link to={`/albums/${record.album_id}`}>{album}</Link>;
      },
    },
    {
      title: '担任角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space wrap>
          {(roles || []).filter(Boolean).map(r => (
            <Tag key={r} color="purple" style={{ fontSize: 11 }}>{r}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 90,
      render: formatDuration,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: any, record: Track) => (
        <Space>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handlePlay(record)} size="small">
            播放
          </Button>
          <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
            <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record)} size="small" disabled={!DOWNLOAD_ENABLED} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const renderMobileTrackList = () => (
    <List
      className="artist-mobile-track-list"
      dataSource={tracks}
      pagination={{ pageSize: 20 }}
      renderItem={(record) => (
        <List.Item>
          <div className="artist-mobile-track-item">
            <div className="artist-mobile-track-meta">
              <a className="artist-mobile-track-title" onClick={() => navigate(`/track/${record.id}`)}>{record.title}</a>
              <Text type="secondary">{record.album_title || '未分配专辑'} · {formatDuration(record.duration || 0)}</Text>
              {((record as any).roles || []).filter(Boolean).length > 0 && (
                <Space size={4} wrap>
                  {((record as any).roles || []).filter(Boolean).map((role: string) => (
                    <Tag key={role} color="purple">{role}</Tag>
                  ))}
                </Space>
              )}
            </div>
            <Space size={6} wrap>
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handlePlay(record)}>播放</Button>
              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)} disabled={!DOWNLOAD_ENABLED}>下载</Button>
              </Tooltip>
            </Space>
          </div>
        </List.Item>
      )}
    />
  );

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Skeleton active avatar={{ size: 200, shape: 'circle' }} paragraph={{ rows: 6 }} />
        </Content>
      </Layout>
    );
  }

  if (!artist) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/artists')}>返回列表</Button>
          <div style={{ marginTop: 24, textAlign: 'center' }}>创作者未找到</div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="artist-detail-layout">
      <Content className="artist-detail-content">
        <div style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/artists')}>
            返回创作者列表
          </Button>
        </div>
        <div className="artist-hero">
          <Avatar size={200} icon={<UserOutlined />} style={{ backgroundColor: '#667eea', fontSize: 80 }} />
          <div className="artist-hero-info">
            <h1>{artist.name}</h1>
            {artist.aliases && artist.aliases.length > 0 && (
              <div style={{ marginBottom: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>
                别名：{artist.aliases.join('、')}
              </div>
            )}
            <div className="artist-stats">
              <Tag color="blue">{artist.track_count || 0} 首歌曲</Tag>
              <Tag color="green">{artist.album_count || 0} 张专辑</Tag>
            </div>
            {games.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>参与游戏：</span>
                {games.map(game => (
                  <div
                    key={game.id}
                    onClick={() => navigate(`/games/${game.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      cursor: 'pointer', padding: '4px 10px', borderRadius: 6,
                      background: 'var(--bg-secondary, rgba(0,0,0,0.04))',
                      transition: 'background 0.2s',
                    }}
                  >
                    {game.cover_path ? (
                      <img
                        src={getCoverUrl(game.cover_path)}
                        alt={game.name}
                        onError={handleImageError}
                        style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }}
                      />
                    ) : (
                      <Avatar size={22} style={{ fontSize: 12, backgroundColor: '#667eea' }}>
                        {game.name.charAt(0)}
                      </Avatar>
                    )}
                    <span style={{ fontSize: 13 }}>{game.name}</span>
                  </div>
                ))}
              </div>
            )}
            {artist.roles && artist.roles.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {artist.roles.filter(Boolean).map(r => (
                  <Tag key={r} color="purple">{r}</Tag>
                ))}
              </div>
            )}
            <Space style={{ marginTop: 24 }}>
              <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={handlePlayAll} disabled={tracks.length === 0}>
                播放全部
              </Button>
            </Space>
          </div>
        </div>

        <Tabs defaultActiveKey="tracks" className="artist-tabs">
          <TabPane tab={`歌曲 (${tracks.length})`} key="tracks">
            {isMobile
              ? renderMobileTrackList()
              : <Table columns={trackColumns} dataSource={tracks} rowKey="id" pagination={{ pageSize: 20 }} />}
          </TabPane>
          <TabPane tab={`专辑 (${albums.length})`} key="albums">
            <Row gutter={[28, 36]}>
              {albums.map((album) => (
                <Col key={album.id} xs={12} sm={12} md={8} lg={6}>
                  <Card
                    hoverable className="album-card"
                    onClick={() => navigate(`/albums/${album.id}`)}
                    cover={
                      <div className="album-cover-wrapper">
                        <img alt={album.title} src={getCoverUrl(album.cover_path, undefined, true)} loading="lazy" onError={handleImageError} />
                      </div>
                    }
                  >
                    <Card.Meta
                      title={album.title}
                      description={
                        <div className="artist-album-meta">
                          <div>{album.track_count || 0} 首</div>
                          {album.release_date && (
                            <div className="artist-album-year">{new Date(album.release_date).getFullYear()}</div>
                          )}
                        </div>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </TabPane>
        </Tabs>
      </Content>
    </Layout>
  );
};

export default ArtistDetail;

