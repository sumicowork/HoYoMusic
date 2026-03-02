import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Table, Button, Space, Image, Skeleton, Descriptions, message, Tooltip } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { albumService } from '../services/albumService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import './AlbumDetail.css';

const { Header, Content } = Layout;

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
      const data = await albumService.getAlbumById(parseInt(id!));
      setAlbum(data.album);
      setTracks(data.tracks);
    } catch (error: any) {
      message.error('加载专辑详情失败');
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
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    window.open(`${apiBase}/albums/${id}/download`, '_blank');
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
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: formatDuration,
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
          <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
              size="small"
              disabled={!DOWNLOAD_ENABLED}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Skeleton active avatar={{ size: 250, shape: 'square' }} paragraph={{ rows: 6 }} />
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
              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadAlbum}
                  disabled={tracks.length === 0 || !DOWNLOAD_ENABLED}
                >
                  下载专辑
                </Button>
              </Tooltip>
            </Space>
          </div>
        </div>

        <div className="album-tracks">
          <h2>曲目列表</h2>
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


