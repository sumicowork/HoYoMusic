import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Table, Button, Space, Tag, Skeleton, Avatar, Tabs, Card, Row, Col, message, Tooltip } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined, UserOutlined } from '@ant-design/icons';
import { IS_STATIC } from '../services/api';
import * as staticData from '../services/staticDataService';
import axios from 'axios';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import './ArtistDetail.css';

const { Header, Content } = Layout;
const { TabPane } = Tabs;
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

interface Artist {
  id: null;
  name: string;
  track_count: number;
  album_count: number;
  roles: string[];
}

interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  track_count: number;
}

const ArtistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();  // actually the person's name (encoded)
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const { play, setPlaylist, playTrackOnly } = usePlayerStore();

  useEffect(() => {
    if (id) fetchArtistDetails();
  }, [id]);

  const fetchArtistDetails = async () => {
    try {
      if (IS_STATIC) {
        const data = await staticData.getArtistById(decodeURIComponent(id!));
        setArtist(data.artist);
        setTracks(data.tracks);
        setAlbums(data.albums);
      } else {
        const response = await axios.get(`${API_BASE_URL}/artists/${id}`);
        if (response.data.success) {
          setArtist(response.data.data.artist);
          setTracks(response.data.data.tracks);
          setAlbums(response.data.data.albums);
        }
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
      render: (album: string) => album || '-',
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
      title: '音质',
      key: 'quality',
      width: 110,
      render: (_: any, record: Track) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">FLAC</Tag>
          {record.sample_rate && record.bit_depth && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {(record.sample_rate / 1000).toFixed(1)}kHz/{record.bit_depth}bit
            </span>
          )}
        </Space>
      ),
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
      <Header className="artist-detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/artists')}>
          返回创作者列表
        </Button>
      </Header>

      <Content className="artist-detail-content">
        <div className="artist-hero">
          <Avatar size={200} icon={<UserOutlined />} style={{ backgroundColor: '#667eea', fontSize: 80 }} />
          <div className="artist-hero-info">
            <h1>{artist.name}</h1>
            <div className="artist-stats">
              <Tag color="blue">{artist.track_count || 0} 首歌曲</Tag>
              <Tag color="green">{artist.album_count || 0} 张专辑</Tag>
            </div>
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
            <Table columns={trackColumns} dataSource={tracks} rowKey="id" pagination={{ pageSize: 20 }} />
          </TabPane>
          <TabPane tab={`专辑 (${albums.length})`} key="albums">
            <Row gutter={[16, 16]}>
              {albums.map((album) => (
                <Col key={album.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable className="album-card"
                    onClick={() => navigate(`/albums/${album.id}`)}
                    cover={
                      <div className="album-cover-wrapper">
                        <img alt={album.title} src={getCoverUrl(album.cover_path)} onError={handleImageError} />
                      </div>
                    }
                  >
                    <Card.Meta
                      title={album.title}
                      description={
                        <div>
                          <div>{album.track_count || 0} 首</div>
                          {album.release_date && (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(album.release_date).getFullYear()}</div>
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

