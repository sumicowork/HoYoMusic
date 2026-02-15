import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Table, Button, Space, Image, Tag, Spin, Descriptions, message } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Track } from '../types';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import './AlbumDetail.css';

const { Header, Content } = Layout;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  track_count: number;
  total_duration: number;
}

const AlbumDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const { play, setPlaylist, playTrackOnly } = usePlayerStore();

  useEffect(() => {
    if (id) {
      fetchAlbumDetails();
    }
  }, [id]);

  const fetchAlbumDetails = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/albums/${id}`);
      if (response.data.success) {
        setAlbum(response.data.data.album);
        setTracks(response.data.data.tracks);
      }
    } catch (error: any) {
      message.error('Failed to load album details');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track: Track) => {
    // Only add this single track to queue, don't replace entire playlist
    playTrackOnly(track);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      // Replace playlist with all tracks from album
      setPlaylist(tracks);
      play(tracks[0]);
    }
  };

  const handleDownload = (track: Track) => {
    window.open(trackService.getDownloadUrlPublic(track.id), '_blank');
  };

  const handleDownloadAlbum = () => {
    window.open(`${API_BASE_URL}/albums/${id}/download`, '_blank');
  };


  const formatDuration = (seconds: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (seconds: number) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
    }
    return `${minutes} minutes`;
  };


  const columns = [
    {
      title: '#',
      dataIndex: 'track_number',
      key: 'track_number',
      width: 60,
      render: (num: number) => num || '-',
    },
    {
      title: '标题',
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
      title: '艺术家',
      dataIndex: 'artists',
      key: 'artists',
      render: (artists: any[]) => artists.map((a) => a.name).join(', '),
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: formatDuration,
    },
    {
      title: '品质',
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
      title: '操作',
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
            播放
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

  if (!album) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/albums')}>
            返回专辑列表
          </Button>
          <div style={{ marginTop: 24, textAlign: 'center' }}>专辑未找到</div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="album-detail-layout">
      <Header className="album-detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/albums')}>
          返回专辑列表
        </Button>
      </Header>

      <Content className="album-detail-content">
        <div className="album-hero">
          <Image
            width={250}
            height={250}
            src={trackService.getCoverUrl(album.cover_path)}
            fallback={MUSIC_ICON_PLACEHOLDER}
            style={{ borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          />
          <div className="album-hero-info">
            <h1>{album.title}</h1>
            <Descriptions column={1} size="small" className="album-descriptions">
              <Descriptions.Item label="总曲目数">{album.track_count || 0}</Descriptions.Item>
              <Descriptions.Item label="总时长">
                {formatTotalDuration(album.total_duration)}
              </Descriptions.Item>
              {album.release_date && (
                <Descriptions.Item label="发行日期">
                  {new Date(album.release_date).toLocaleDateString('zh-CN')}
                </Descriptions.Item>
              )}
            </Descriptions>
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
              <Button
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleDownloadAlbum}
                disabled={tracks.length === 0}
              >
                下载专辑
              </Button>
            </Space>
          </div>
        </div>

        <div className="album-tracks">
          <h2>Tracks</h2>
          <Table
            columns={columns}
            dataSource={tracks}
            rowKey="id"
            pagination={false}
          />
        </div>
      </Content>
    </Layout>
  );
};

export default AlbumDetail;


