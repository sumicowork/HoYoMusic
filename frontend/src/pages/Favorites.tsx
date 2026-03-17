import React, { useState, useEffect, useCallback } from 'react';
import { Table, Typography, Space, Button, Empty, message } from 'antd';
import { HeartFilled, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '../store/playerStore';
import favoriteService from '../services/favoriteService';
import type { Track } from '../types';

const { Title } = Typography;

const Favorites: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  const { play, playTrackOnly, setPlaylist: setPlayerPlaylist } = usePlayerStore();

  const loadFavorites = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await favoriteService.getFavorites(page, 50);
      setTracks(data.tracks);
      setPagination({ page: data.pagination.page, total: data.pagination.total });
    } catch {
      message.error('加载收藏失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setPlayerPlaylist(tracks);
      play(tracks[0]);
    }
  };

  const handleRemove = async (trackId: number) => {
    try {
      await favoriteService.toggle(trackId);
      setTracks(prev => prev.filter(t => t.id !== trackId));
      message.success('已取消收藏');
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '曲名',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Track) => (
        <Link to={`/track/${record.id}`}>{title}</Link>
      ),
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album_title',
      render: (albumTitle: string, record: Track) => {
        if (!albumTitle) return '—';
        if (!record.album_id) return albumTitle;
        return <Link to={`/albums/${record.album_id}`}>{albumTitle}</Link>;
      },
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (d: number) => d ? `${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')}` : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_: any, record: Track) => (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => playTrackOnly(record)}
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleRemove(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }} align="center">
        <HeartFilled style={{ fontSize: 24, color: '#ff4d6a' }} />
        <Title level={3} style={{ margin: 0 }}>我的收藏</Title>
        {tracks.length > 0 && (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlayAll}>
            播放全部
          </Button>
        )}
      </Space>

      {tracks.length === 0 && !loading ? (
        <Empty description="还没有收藏任何曲目" />
      ) : (
        <Table
          dataSource={tracks}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: pagination.page,
            total: pagination.total,
            pageSize: 50,
            onChange: (p) => loadFavorites(p),
          }}
        />
      )}
    </div>
  );
};

export default Favorites;

