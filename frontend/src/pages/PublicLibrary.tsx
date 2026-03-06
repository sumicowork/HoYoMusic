import React, { useEffect, useState } from 'react';
import { Layout, Table, Button, Space, Image, Input, Tooltip } from 'antd';
import { PlayCircleOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { useNavigate } from 'react-router-dom';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import './PublicLibrary.css';

const { Content } = Layout;
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
      responsive: ['sm'],
    },
    {
      title: '时长',
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

