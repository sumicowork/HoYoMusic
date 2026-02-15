import React from 'react';
import { Drawer, List, Button, Empty, Typography, Space, Popconfirm } from 'antd';
import { PlayCircleOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../types';
import './PlayQueue.css';

const { Text } = Typography;

interface PlayQueueProps {
  visible: boolean;
  onClose: () => void;
}

const PlayQueue: React.FC<PlayQueueProps> = ({ visible, onClose }) => {
  const { playlist, currentTrack, play, removeFromPlaylist, clearPlaylist } = usePlayerStore();

  const handlePlayTrack = (track: Track) => {
    play(track);
  };

  const handleRemoveTrack = (trackId: number) => {
    removeFromPlaylist(trackId);
  };

  const handleClearPlaylist = () => {
    clearPlaylist();
    onClose();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Drawer
      title={`播放队列 (${playlist.length})`}
      placement="right"
      onClose={onClose}
      open={visible}
      width={400}
      className="play-queue-drawer"
      extra={
        playlist.length > 0 && (
          <Popconfirm
            title="确定要清空播放队列吗？"
            description="此操作将停止播放并清空所有队列歌曲"
            onConfirm={handleClearPlaylist}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<ClearOutlined />}
            >
              清空队列
            </Button>
          </Popconfirm>
        )
      }
    >
      {playlist.length === 0 ? (
        <Empty description="播放队列为空" />
      ) : (
        <List
          dataSource={playlist}
          renderItem={(track, index) => {
            const isCurrentTrack = track.id === currentTrack?.id;
            return (
              <List.Item
                key={track.id}
                className={`queue-item ${isCurrentTrack ? 'current' : ''}`}
                actions={[
                  <Button
                    type="text"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handlePlayTrack(track)}
                    disabled={isCurrentTrack}
                  />,
                  <Popconfirm
                    title="确定要从队列中移除这首歌吗？"
                    onConfirm={() => handleRemoveTrack(track.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div className="queue-item-number">
                      {isCurrentTrack ? '▶' : index + 1}
                    </div>
                  }
                  title={
                    <Text strong={isCurrentTrack} className="queue-item-title">
                      {track.title}
                    </Text>
                  }
                  description={
                    <div className="queue-item-info">
                      <Text type="secondary">
                        {track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
                      </Text>
                      <Text type="secondary" className="queue-item-duration">
                        {formatDuration(track.duration)}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Drawer>
  );
};

export default PlayQueue;



