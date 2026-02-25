import React, { useEffect, useState } from 'react';
import { Layout, Table, Button, Space, Image, Tag, Input, Tooltip } from 'antd';
import { PlayCircleOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { useNavigate } from 'react-router-dom';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import ThemeToggle from '../components/ThemeToggle';
import './PublicLibrary.css';

const { Header, Content } = Layout;
const { Search } = Input;

const PublicLibrary: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchText, setSearchText] = useState('');

  const { playTrackOnly } = usePlayerStore();
  const navigate = useNavigate();

  const fetchTracks = async (page = 1, search = '') => {
    setLoading(true);
    try {
      // 调用公开 API（无需认证）
      const data = await trackService.getTracksPublic(page, pagination.pageSize, search);
      setTracks(data.tracks);
      setPagination({
        ...pagination,
        current: data.pagination.page,
        total: data.pagination.total,
      });
    } catch (error: any) {
      console.error('获取曲目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '--';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const columns: ColumnsType<Track> = [
    {
      title: '封面',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath, record) => {
        const src = coverPath
          ? trackService.getCoverUrl(coverPath)
          : record.album_cover
            ? trackService.getCoverUrl(record.album_cover)
            : undefined;
        return (
          <Image
            width={50}
            height={50}
            src={src}
            fallback={MUSIC_ICON_PLACEHOLDER}
            style={{ borderRadius: 4, objectFit: 'cover' }}
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
        <a
          onClick={() => navigate(`/track/${record.id}`)}
          style={{ color: '#1890ff', cursor: 'pointer' }}
        >
          {title}
        </a>
      ),
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album',
      ellipsis: true,
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
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">FLAC</Tag>
          {record.sample_rate && record.bit_depth && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {(record.sample_rate / 1000).toFixed(1)}kHz / {record.bit_depth}bit
            </span>
          )}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'size',
      width: 120,
      render: formatFileSize,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
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
        </Space>
      ),
    },
  ];

  return (
    <Layout className="library-layout">
      <Header className="library-header">
        <div className="header-content">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>🎵 HoYoMusic</h1>
          <div className="header-actions">
            <ThemeToggle />
            <Search
              placeholder="搜索音乐..."
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              style={{ width: 300, marginRight: 16, marginLeft: 16 }}
            />
          </div>
        </div>
      </Header>
      <Content className="library-content">
        <Table
          columns={columns}
          dataSource={tracks}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total: number) => `Total ${total} tracks`,
          }}
          onChange={(newPagination) => {
            fetchTracks(newPagination.current, searchText);
          }}
        />
      </Content>
    </Layout>
  );
};

export default PublicLibrary;

