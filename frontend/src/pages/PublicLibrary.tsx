import React, { useEffect, useState } from 'react';
import { Layout, Table, Button, Space, Image, Input, Tooltip, message, Grid, List, Tag } from 'antd';
import { PlayCircleOutlined, DownloadOutlined, SearchOutlined, HeartOutlined, HeartFilled, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { Link } from 'react-router-dom';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import { formatDuration } from '../utils/format';
import favoriteService from '../services/favoriteService';
import playlistService from '../services/playlistService';
import PlaylistPickerModal from '../components/PlaylistPickerModal';
import { useDebugUserFeatures } from '../utils/debugFeature';
import './PublicLibrary.css';

const { Content } = Layout;
const { Search } = Input;
const { useBreakpoint } = Grid;

const PublicLibrary: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [favoritesMap, setFavoritesMap] = useState<Record<number, boolean>>({});
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const canUseDebugFeatures = useDebugUserFeatures();

  const { playTrackOnly } = usePlayerStore();

  const fetchTracks = async (page = 1, search = '', pageSize?: number) => {
    const size = pageSize ?? pagination.pageSize;
    setLoading(true);
    try {
      const data = await trackService.getTracksPublic(page, size, search);
      setTracks(data.tracks);
      setPagination(prev => ({
        ...prev,
        current: data.pagination.page,
        total: data.pagination.total,
        pageSize: size,
      }));
    } catch (error: any) {
      console.error('获取曲目失败:', error);
      message.error('加载曲目失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    if (!canUseDebugFeatures || tracks.length === 0) {
      setFavoritesMap({});
      return;
    }

    let canceled = false;
    favoriteService.checkFavorites(tracks.map((t) => t.id))
      .then((map) => {
        if (!canceled) {
          setFavoritesMap(map || {});
        }
      })
      .catch(() => {
        if (!canceled) {
          setFavoritesMap({});
        }
      });

    return () => {
      canceled = true;
    };
  }, [tracks, canUseDebugFeatures]);

  const handlePlay = (track: Track) => {
    // Only add this single track to queue
    playTrackOnly(track);
  };

  const handleDownload = (track: Track) => {
    window.open(trackService.getDownloadUrlPublic(track.id), '_blank');
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchTracks(1, value);
  };

  const handleToggleFavorite = async (trackId: number) => {
    try {
      const result = await favoriteService.toggle(trackId);
      setFavoritesMap((prev) => ({ ...prev, [trackId]: result.favorited }));
      message.success(result.favorited ? '已添加到收藏' : '已取消收藏');
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || '收藏操作失败';
      message.error(msg);
    }
  };

  const openPlaylistModal = async (trackId: number) => {
    setSelectedTrackId(trackId);
    setPlaylistModalOpen(true);
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    if (!selectedTrackId) {
      return;
    }
    try {
      await playlistService.addTrack(playlistId, selectedTrackId);
      message.success('已添加到歌单');
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || '添加到歌单失败';
      message.error(msg);
    }
  };

  const columns: ColumnsType<Track> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath, record) => {
        const coverSrc = coverPath || record.album_cover;
        const thumbSrc = coverSrc
          ? trackService.getCoverUrl(coverSrc, true)
          : undefined;
        const fullSrc = coverSrc
          ? trackService.getCoverUrl(coverSrc)
          : undefined;
        return (
          <Image
            width={50}
            height={50}
            src={thumbSrc}
            fallback={MUSIC_ICON_PLACEHOLDER}
            style={{ borderRadius: 4, objectFit: 'cover' }}
            preview={fullSrc ? { src: fullSrc } : false}
          />
        );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: Track) => (
        <Link to={`/track/${record.id}`} style={{ color: '#1890ff' }}>
          {title}
        </Link>
      ),
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album',
      ellipsis: true,
      responsive: ['sm'],
      render: (albumTitle: string, record: Track) => {
        if (!albumTitle) return '—';
        if (!record.album_id) return albumTitle;
        return <Link to={`/albums/${record.album_id}`}>{albumTitle}</Link>;
      },
    },
    {
      dataIndex: 'duration',
      key: 'duration',
      width: 70,
      responsive: ['sm'],
      render: formatDuration,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
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
          {canUseDebugFeatures && (
            <Button
              type="text"
              icon={favoritesMap[record.id] ? <HeartFilled style={{ color: '#ff4d6a' }} /> : <HeartOutlined />}
              onClick={() => handleToggleFavorite(record.id)}
              title={favoritesMap[record.id] ? '取消喜爱' : '喜爱'}
            />
          )}
          {canUseDebugFeatures && (
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => openPlaylistModal(record.id)}
              title="收藏到歌单"
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <Layout className="library-layout">
      <Content className="library-content">
        <div className="library-toolbar">
          <Search
            placeholder="搜索音乐..."
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ maxWidth: 400 }}
          />
        </div>
        {isMobile ? (
          <List
            className="public-library-mobile-list"
            loading={loading}
            dataSource={tracks}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total: number) => `共 ${total} 首曲目`,
              onChange: (page, pageSize) => {
                fetchTracks(page, searchText, pageSize || pagination.pageSize);
              },
            }}
            renderItem={(record) => {
              const coverSrc = record.cover_path || record.album_cover;
              const thumbSrc = coverSrc
                ? trackService.getCoverUrl(coverSrc, true)
                : undefined;

              return (
                <List.Item>
                  <div className="public-library-mobile-item">
                    <div className="public-library-mobile-main">
                      <Image
                        width={54}
                        height={54}
                        src={thumbSrc}
                        fallback={MUSIC_ICON_PLACEHOLDER}
                        style={{ borderRadius: 8, objectFit: 'cover' }}
                        preview={false}
                      />
                      <div className="public-library-mobile-meta">
                        <Link to={`/track/${record.id}`} className="public-library-mobile-title">{record.title}</Link>
                        <div className="public-library-mobile-sub">{record.album_title || '未分配专辑'}</div>
                        <div className="public-library-mobile-chips">
                          <Tag color="blue">{formatDuration(record.duration || 0)}</Tag>
                          {record.release_date && (
                            <Tag>{new Date(record.release_date).getFullYear()} 年</Tag>
                          )}
                        </div>
                      </div>
                    </div>
                    <Space size={8} wrap className="public-library-mobile-actions">
                      <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handlePlay(record)}>
                        播放
                      </Button>
                      <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)} disabled={!DOWNLOAD_ENABLED}>
                          下载
                        </Button>
                      </Tooltip>
                    </Space>
                  </div>
                </List.Item>
              );
            }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tracks}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total: number) => `共 ${total} 首曲目`,
            }}
            onChange={(newPagination) => {
              const newSize = newPagination.pageSize || pagination.pageSize;
              const newPage = newPagination.pageSize !== pagination.pageSize ? 1 : (newPagination.current || 1);
              fetchTracks(newPage, searchText, newSize);
            }}
          />
        )}

        <PlaylistPickerModal
          title="收藏到歌单"
          open={playlistModalOpen}
          onCancel={() => setPlaylistModalOpen(false)}
          onSubmit={handleAddToPlaylist}
        />
      </Content>
    </Layout>
  );
};

export default PublicLibrary;

