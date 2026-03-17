import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Typography, Button, Space, message, Empty, Popconfirm } from 'antd';
import { PlayCircleOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '../store/playerStore';
import playlistService from '../services/playlistService';
import type { Track } from '../types';

const { Title, Text } = Typography;

const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { play, playTrackOnly, setPlaylist: setPlayerPlaylist } = usePlayerStore();

  const loadPlaylist = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await playlistService.getPlaylistById(parseInt(id));
      setPlaylist(data.playlist);
      setTracks(data.tracks);
    } catch {
      message.error('加载播放列表失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadPlaylist(); }, [loadPlaylist]);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setPlayerPlaylist(tracks);
      play(tracks[0]);
    }
  };

  const handleRemoveTrack = async (trackId: number) => {
    if (!id) return;
    try {
      await playlistService.removeTrack(parseInt(id), trackId);
      setTracks(prev => prev.filter(t => t.id !== trackId));
      message.success('已移除');
    } catch {
      message.error('移除失败');
    }
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'position',
      key: 'position',
      width: 50,
    },
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
      width: 100,
      render: (_: any, record: Track) => (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => playTrackOnly(record)}
          />
          <Popconfirm title="确认移除?" onConfirm={() => handleRemoveTrack(record.id)}>
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) return <div style={{ padding: 24 }}>加载中...</div>;

  return (
    <div style={{ padding: 24 }}>
      <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/playlists')} style={{ marginBottom: 12 }}>
        返回
      </Button>

      {playlist && (
        <Space style={{ marginBottom: 16 }} align="center">
          <Title level={3} style={{ margin: 0 }}>{playlist.name}</Title>
          <Text type="secondary">{playlist.track_count} 首</Text>
          {tracks.length > 0 && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlayAll}>
              播放全部
            </Button>
          )}
        </Space>
      )}

      {playlist?.description && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{playlist.description}</Text>
      )}

      {tracks.length === 0 ? (
        <Empty description="播放列表为空" />
      ) : (
        <Table
          dataSource={tracks}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      )}
    </div>
  );
};

export default PlaylistDetail;

