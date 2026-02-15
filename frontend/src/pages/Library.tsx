import React, { useEffect, useState } from 'react';
import { Layout, Table, Button, Upload, message, Space, Image, Tag } from 'antd';
import { UploadOutlined, PlayCircleOutlined, DownloadOutlined, LogoutOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Track } from '../types';
import { trackService } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import './Library.css';

const { Header, Content } = Layout;

const Library: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const { playTrackOnly } = usePlayerStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const fetchTracks = async (page = 1) => {
    setLoading(true);
    try {
      const data = await trackService.getTracks(page, pagination.pageSize);
      setTracks(data.tracks);
      setPagination({
        ...pagination,
        current: data.pagination.page,
        total: data.pagination.total,
      });
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch tracks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    return { abort() {} };
  };

  const handleUploadChange = async (info: any) => {
    if (info.fileList.length > 0 && !uploading) {
      setUploading(true);
      try {
        const files = info.fileList.map((f: any) => f.originFileObj);
        await trackService.uploadTracks(files);
        message.success(`${info.fileList.length} track(s) uploaded successfully`);
        fetchTracks();
      } catch (error: any) {
        message.error(error.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    }
  };

  const handlePlay = (track: Track) => {
    // Only add this single track to queue
    playTrackOnly(track);
  };

  const handleDownload = (track: Track) => {
    window.open(trackService.getDownloadUrl(track.id), '_blank');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
      title: 'Cover',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 80,
      render: (coverPath) => (
        <Image
          width={50}
          height={50}
          src={trackService.getCoverUrl(coverPath)}
          fallback={MUSIC_ICON_PLACEHOLDER}
          style={{ borderRadius: 4, objectFit: 'cover' }}
        />
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Artist',
      dataIndex: 'artists',
      key: 'artists',
      render: (artists: any[]) => artists.map((a) => a.name).join(', '),
    },
    {
      title: 'Album',
      dataIndex: 'album_title',
      key: 'album',
      ellipsis: true,
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
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">FLAC</Tag>
          {record.sample_rate && record.bit_depth && (
            <span style={{ fontSize: 12, color: '#888' }}>
              {(record.sample_rate / 1000).toFixed(1)}kHz / {record.bit_depth}bit
            </span>
          )}
        </Space>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'file_size',
      key: 'size',
      width: 120,
      render: formatFileSize,
    },
    {
      title: 'Actions',
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

  return (
    <Layout className="library-layout">
      <Header className="library-header">
        <div className="header-content">
          <h1>🎵 HoYoMusic</h1>
          <Space>
            <span>Welcome, {user?.username}</span>
            <Upload
              customRequest={handleUpload}
              onChange={handleUploadChange}
              multiple
              accept=".flac"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                Upload FLAC Files
              </Button>
            </Upload>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              Logout
            </Button>
          </Space>
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
            showTotal: (total) => `Total ${total} tracks`,
          }}
          onChange={(pagination) => {
            fetchTracks(pagination.current);
          }}
        />
      </Content>
    </Layout>
  );
};

export default Library;

