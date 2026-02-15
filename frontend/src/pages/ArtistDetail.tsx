import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Table, Button, Space, Tag, Spin, Avatar, Tabs, Card, Row, Col, message } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Track } from '../types';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import './ArtistDetail.css';

const { Header, Content } = Layout;
const { TabPane } = Tabs;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Artist {
  id: number;
  name: string;
  track_count: number;
  album_count: number;
}

interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  track_count: number;
}

const ArtistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const { play, setPlaylist, playTrackOnly } = usePlayerStore();

  useEffect(() => {
    if (id) {
      fetchArtistDetails();
    }
  }, [id]);

  const fetchArtistDetails = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/artists/${id}`);
      if (response.data.success) {
        setArtist(response.data.data.artist);
        setTracks(response.data.data.tracks);
        setAlbums(response.data.data.albums);
      }
    } catch (error: any) {
      message.error('Failed to load artist details');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track: Track) => {
    // Only add this single track to queue
    playTrackOnly(track);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setPlaylist(tracks);
      play(tracks[0]);
    }
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
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Track) => (
        <a
          onClick={() => navigate(`/track/${record.id}`)}
          style={{ color: '#1890ff', cursor: 'pointer' }}
        >
          {title}
        </a>
      ),
    },
    {
      title: 'Album',
      dataIndex: 'album_title',
      key: 'album',
      render: (album: string) => album || '-',
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: formatDuration,
    },
    {
      title: 'Quality',
      key: 'quality',
      width: 120,
      render: (_: any, record: Track) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">FLAC</Tag>
          {record.sample_rate && record.bit_depth && (
            <span style={{ fontSize: 11, color: '#888' }}>
              {(record.sample_rate / 1000).toFixed(1)}kHz/{record.bit_depth}bit
            </span>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_: any, record: Track) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handlePlay(record)}
            size="small"
          >
            Play
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            size="small"
          />
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (!artist) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/artists')}>
            返回艺术家列表
          </Button>
          <div style={{ marginTop: 24, textAlign: 'center' }}>艺术家未找到</div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="artist-detail-layout">
      <Header className="artist-detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/artists')}>
          Back to Artists
        </Button>
      </Header>

      <Content className="artist-detail-content">
        <div className="artist-hero">
          <Avatar
            size={200}
            icon={<UserOutlined />}
            style={{
              backgroundColor: '#1890ff',
              fontSize: 80,
            }}
          />
          <div className="artist-hero-info">
            <h1>{artist.name}</h1>
            <div className="artist-stats">
              <Tag color="blue">{artist.track_count || 0} 首歌曲</Tag>
              <Tag color="purple">{artist.album_count || 0} 张专辑</Tag>
            </div>
            <Space style={{ marginTop: 24 }}>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
              >
                播放全部
              </Button>
            </Space>
          </div>
        </div>

        <Tabs defaultActiveKey="tracks" className="artist-tabs">
          <TabPane tab={`歌曲 (${tracks.length})`} key="tracks">
            <Table
              columns={trackColumns}
              dataSource={tracks}
              rowKey="id"
              pagination={{ pageSize: 20 }}
            />
          </TabPane>
          <TabPane tab={`专辑 (${albums.length})`} key="albums">
            <Row gutter={[16, 16]}>
              {albums.map((album) => (
                <Col key={album.id} xs={24} sm={12} md={8} lg={6}>
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
                        <div>
                          <div>{album.track_count || 0} 首</div>
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
          </TabPane>
        </Tabs>
      </Content>
    </Layout>
  );
};

export default ArtistDetail;


