import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Tag as AntTag,
  Table,
  Space,
  message
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { getTagById, Tag } from '../services/tagService';
import { usePlayerStore } from '../store/playerStore';
import { trackService } from '../services/trackService';
import './TagDetail.css';

const TagDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const { play, setPlaylist, playTrackOnly } = usePlayerStore();

  useEffect(() => {
    if (id) {
      fetchTagDetails();
    }
  }, [id]);

  const fetchTagDetails = async () => {
    try {
      setLoading(true);
      const data = await getTagById(parseInt(id!));
      setTag(data);
    } catch (error) {
      console.error('Failed to fetch tag:', error);
      message.error('获取标签详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAll = () => {
    if (tag && tag.tracks && tag.tracks.length > 0) {
      setPlaylist(tag.tracks);
      play(tag.tracks[0]);
      message.success('开始播放');
    }
  };

  const handlePlay = (track: any) => {
    // Only add this single track to queue
    playTrackOnly(track);
  };

  const handleDownload = (trackId: number) => {
    window.open(trackService.getDownloadUrlPublic(trackId), '_blank');
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      render: (title: string) => <strong>{title}</strong>,
    },
    {
      title: '艺术家',
      dataIndex: 'artist_name',
      key: 'artist_name',
      width: 200,
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album_title',
      width: 200,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration: number) => formatDuration(duration),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handlePlay(record)}
          >
            播放
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id)}
          >
            下载
          </Button>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="tag-detail-container">
        <div className="loading-container">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="tag-detail-container">
        <Empty description="标签不存在" />
      </div>
    );
  }

  return (
    <div className="tag-detail-container">
      <div className="tag-detail-header">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/tags')}
          style={{ marginBottom: 24 }}
        >
          返回
        </Button>

        <div className="tag-detail-info">
          <div className="tag-detail-icon" style={{ backgroundColor: tag.color }}>
            <span style={{ fontSize: 48 }}>🏷️</span>
          </div>

          <div className="tag-detail-meta">
            <AntTag color={tag.color} style={{ fontSize: 16, padding: '4px 12px' }}>
              标签
            </AntTag>
            <h1>{tag.name}</h1>
            {tag.description && (
              <p className="tag-description">{tag.description}</p>
            )}
            <div className="tag-stats">
              <span>{tag.track_count || 0} 首歌曲</span>
            </div>

            <Space style={{ marginTop: 24 }}>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handlePlayAll}
                disabled={!tag.tracks || tag.tracks.length === 0}
              >
                播放全部
              </Button>
            </Space>
          </div>
        </div>
      </div>

      <div className="tag-detail-tracks">
        {!tag.tracks || tag.tracks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="此标签下还没有歌曲"
            style={{ marginTop: 60 }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tag.tracks}
            rowKey="id"
            pagination={false}
          />
        )}
      </div>
    </div>
  );
};

export default TagDetail;

