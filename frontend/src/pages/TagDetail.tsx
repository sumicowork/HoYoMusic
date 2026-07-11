import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Layout,
  Button,
  Empty,
  Tag as AntTag,
  Table,
  Space,
  message,
  Tooltip,
  Grid,
  List,
  Typography
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { getTagById, getTagGroups, Tag, TagGroup } from '../services/tagService';
import { usePlayerStore } from '../store/playerStore';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { buildTagPathLookup, getTagPathLabel } from '../utils/tagPath';
import './TagDetail.css';

const { Content } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

const TagDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tag, setTag] = useState<Tag | null>(null);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const tagPathLookup = useMemo(() => (tag ? buildTagPathLookup([tag], tagGroups) : undefined), [tag, tagGroups]);
  const { play, setPlaylist, playTrackOnly } = usePlayerStore();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  useEffect(() => {
    if (id) {
      fetchTagDetails();
      fetchTagGroups();
    }
  }, [id]);

  const fetchTagGroups = async () => {
    try {
      const data = await getTagGroups();
      setTagGroups(data);
    } catch (error) {
      console.error('Failed to fetch tag groups:', error);
    }
  };

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
      render: (title: string, record: any) => <Link to={`/track/${record.id}`}><strong>{title}</strong></Link>,
    },
    {
      title: '创作者',
      dataIndex: 'artist_name',
      key: 'artist_name',
      width: 200,
      render: (artistName: string) => artistName
        ? <Link to={`/artists/${encodeURIComponent(artistName)}`}>{artistName}</Link>
        : '—',
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album_title',
      width: 200,
      render: (albumTitle: string, record: any) => {
        if (!albumTitle) return '—';
        if (!record.album_id) return albumTitle;
        return <Link to={`/albums/${record.album_id}`}>{albumTitle}</Link>;
      },
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
          <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record.id)}
              disabled={!DOWNLOAD_ENABLED}
            >
              下载
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const renderMobileTrackList = () => (
    <List
      className="tag-mobile-track-list"
      dataSource={tag?.tracks || []}
      renderItem={(record: any) => (
        <List.Item>
          <div className="tag-mobile-track-item">
            <div className="tag-mobile-track-main">
              <Link className="tag-mobile-track-title" to={`/track/${record.id}`}><strong>{record.title}</strong></Link>
              <Text type="secondary">{record.artist_name || '未知创作者'} · {record.album_title || '未分配专辑'}</Text>
              <AntTag>{formatDuration(record.duration || 0)}</AntTag>
            </div>
            <Space size={6} wrap>
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handlePlay(record)}>播放</Button>
              <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : ''}>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record.id)} disabled={!DOWNLOAD_ENABLED}>下载</Button>
              </Tooltip>
            </Space>
          </div>
        </List.Item>
      )}
    />
  );

  if (loading) {
    return (
      <Layout className="tag-detail-layout">
        <Content className="tag-detail-content">
          <div className="loading-container"><p>加载中...</p></div>
        </Content>
      </Layout>
    );
  }

  if (!tag) {
    return (
      <Layout className="tag-detail-layout">
        <Content className="tag-detail-content">
          <Empty description="标签不存在" />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="tag-detail-layout">
      <Content className="tag-detail-content">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tags')} style={{ marginBottom: 24 }}>
          返回标签列表
        </Button>

        <div className="tag-detail-info">
          <div className="tag-detail-icon" style={{ backgroundColor: tag.color }}>
            <span style={{ fontSize: 48 }}>🏷️</span>
          </div>

          <div className="tag-detail-meta">
            <AntTag color={tag.color} style={{ fontSize: 16, padding: '4px 12px' }}>
              标签
            </AntTag>
            <h1>{getTagPathLabel(tag, tagPathLookup)}</h1>
            {tag.description && <p className="tag-description">{tag.description}</p>}
            <div className="tag-stats"><span>{tag.track_count || 0} 首歌曲</span></div>

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

        <div className="tag-detail-tracks">
          {!tag.tracks || tag.tracks.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="此标签下还没有歌曲" style={{ marginTop: 60 }} />
          ) : (
            isMobile
              ? renderMobileTrackList()
              : <Table columns={columns} dataSource={tag.tracks} rowKey="id" pagination={false} />
          )}
        </div>
      </Content>
    </Layout>
  );
};

export default TagDetail;

