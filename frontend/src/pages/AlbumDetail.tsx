import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Table, Button, Space, Image, Skeleton, Descriptions, message, Tooltip, Card, Typography, Grid, List, Tag, Collapse } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { albumService } from '../services/albumService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import './AlbumDetail.css';

const { Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Album {
  id: number;
  title: string;
  title_cn?: string | null;
  title_en?: string | null;
  cover_path: string;
  release_date: string;
  track_count: number;
  total_duration: number;
  notes?: string | null;
}

interface Disc {
  id: number;
  disc_number: number;
  disc_title: string | null;
}

const AlbumDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);
  const albumTitleCn = (album?.title_cn && album.title_cn.trim()) || album?.title || '';
  const albumTitleEn = (album?.title_en && album.title_en.trim()) || '';

  const { play, setPlaylist, playTrackOnly, currentTrack } = usePlayerStore();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

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
      setDiscs(data.discs || []);
    } catch (error: any) {
      message.error('加载专辑详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track: Track) => {
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

  const handleDownloadAlbum = () => {
    const apiBase = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
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

  // Group tracks by disc
  const discGroups = useMemo(() => {
    if (discs.length === 0) return null;
    const groups: { disc: Disc; tracks: Track[] }[] = [];

    // Build groups in disc_number order
    for (const disc of [...discs].sort((a, b) => a.disc_number - b.disc_number)) {
      const discTracks = tracks.filter(t => t.disc_id === disc.id);
      if (discTracks.length > 0) {
        groups.push({ disc, tracks: discTracks });
      }
    }

    // Tracks without disc assignment
    const unassigned = tracks.filter(t => !t.disc_id);
    if (unassigned.length > 0 && groups.length > 0) {
      groups.push({ disc: { id: 0, disc_number: 0, disc_title: '其他曲目' }, tracks: unassigned });
    }

    return groups.length > 0 ? groups : null;
  }, [tracks, discs]);

  const mobileTrackActionBarOffsetClass = currentTrack
    ? 'album-mobile-action-bar with-player'
    : 'album-mobile-action-bar';

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
        <span>
          <a
            onClick={() => navigate(`/track/${record.id}`)}
            style={{ color: '#1890ff', cursor: 'pointer' }}
          >
            {(record.title_cn && record.title_cn.trim()) || title}
          </a>
          {record.title_en && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{record.title_en}</Text>}
          {record.notes && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
              {record.notes}
            </Text>
          )}
        </span>
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

  const renderMobileTrackList = (list: Track[]) => (
    <List
      className="album-mobile-track-list"
      dataSource={list}
      renderItem={(track) => (
        <List.Item>
          <div className="album-mobile-track-item">
            <div className="album-mobile-track-main">
              <span className="album-mobile-track-no">{track.track_number || '-'}</span>
              <div className="album-mobile-track-meta">
                <a onClick={() => navigate(`/track/${track.id}`)}>{(track.title_cn && track.title_cn.trim()) || track.title}</a>
                {track.title_en && <Text type="secondary">{track.title_en}</Text>}
                {track.notes && <Text type="secondary">{track.notes}</Text>}
                <Tag>{formatDuration(track.duration || 0)}</Tag>
              </div>
            </div>
            <Space size={6} wrap>
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handlePlay(track)}>播放</Button>
              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(track)} disabled={!DOWNLOAD_ENABLED}>下载</Button>
              </Tooltip>
            </Space>
          </div>
        </List.Item>
      )}
    />
  );

  const mobileDiscPanels = useMemo(() => {
    if (!discGroups) return null;

    return discGroups.map((group) => ({
      key: String(group.disc.id),
      label: (
        <div className="album-disc-header-mobile">
          <span className="album-disc-number">Disc {group.disc.disc_number || '?'}</span>
          {group.disc.disc_title && <span className="album-disc-title">{group.disc.disc_title}</span>}
          <Tag color="blue">{group.tracks.length} 首</Tag>
        </div>
      ),
      children: renderMobileTrackList(group.tracks),
    }));
  }, [discGroups]);

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
      <Content className="album-detail-content">
        <div className="album-detail-back-wrap">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/albums')}>
            返回专辑列表
          </Button>
        </div>
        <div className="album-hero">
          <Image
            width={isMobile ? 180 : 250}
            height={isMobile ? 180 : 250}
            src={trackService.getCoverUrl(album.cover_path, true)}
            fallback={MUSIC_ICON_PLACEHOLDER}
            className="album-cover-image"
            preview={album.cover_path ? { src: trackService.getCoverUrl(album.cover_path) } : false}
          />
          <div className="album-hero-info">
            <h1>{albumTitleCn}</h1>
            {albumTitleEn && <Text type="secondary" className="album-subtitle">{albumTitleEn}</Text>}
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
            {album.notes && (
              <Card size="small" className="album-notes-card">
                <Text type="secondary" className="album-notes-text">
                  📝 {album.notes}
                </Text>
              </Card>
            )}
            <Space className="album-hero-actions" wrap>
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
          {discGroups ? (
            isMobile ? (
              <Collapse
                className="album-disc-collapse"
                bordered={false}
                defaultActiveKey={mobileDiscPanels?.[0] ? [mobileDiscPanels[0].key] : []}
                items={mobileDiscPanels || []}
              />
            ) : (
              discGroups.map(group => (
                <div key={group.disc.id} style={{ marginBottom: 32 }}>
                  <div className="album-disc-header">
                    <span className="album-disc-number">💿 Disc {group.disc.disc_number || '?'}</span>
                    {group.disc.disc_title && (
                      <span className="album-disc-title"> — {group.disc.disc_title}</span>
                    )}
                  </div>
                  <Table
                    columns={columns}
                    dataSource={group.tracks}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                </div>
              ))
            )
          ) : (
            isMobile
              ? renderMobileTrackList(tracks)
              : (
                <Table
                  columns={columns}
                  dataSource={tracks}
                  rowKey="id"
                  pagination={false}
                />
              )
          )}
        </div>

        {isMobile && (
          <div className={mobileTrackActionBarOffsetClass}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
            >
              播放全部
            </Button>
            <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadAlbum}
                disabled={tracks.length === 0 || !DOWNLOAD_ENABLED}
              >
                下载专辑
              </Button>
            </Tooltip>
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default AlbumDetail;

