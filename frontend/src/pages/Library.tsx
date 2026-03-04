import React, { useEffect, useState } from 'react';
import { Layout, Table, Button, Upload, message, Space, Image, Tooltip } from 'antd';
import { UploadOutlined, PlayCircleOutlined, DownloadOutlined, LogoutOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Track } from '../types';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
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
      message.error(error.message || '获取曲目失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const handleUpload = async (_options: any) => {
    return { abort() {} };
  };

  const handleUploadChange = async (info: any) => {
    if (info.fileList.length > 0 && !uploading) {
      setUploading(true);
      try {
        const files = info.fileList.map((f: any) => f.originFileObj);
        await trackService.uploadTracks(files);
        message.success(`成功上传 ${info.fileList.length} 首`);
        fetchTracks();
      } catch (error: any) {
        message.error(error.message || '上传失败');
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
      <Header className="library-header">
        <div className="header-content">
          <h1>🎵 HoYoMusic</h1>
          <Space>
            <span>欢迎，{user?.username}</span>
            <Upload
              customRequest={handleUpload}
              onChange={handleUploadChange}
              multiple
              accept=".flac"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                上传 FLAC 文件
              </Button>
            </Upload>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
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
            showTotal: (total) => `共 ${total} 首曲目`,
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

