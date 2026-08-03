import React from 'react';
import { Drawer, Button, Empty, Typography, Popconfirm } from 'antd';
import { PlayCircleOutlined, DeleteOutlined, ClearOutlined, HolderOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../types';
import { formatDuration } from '../utils/format';
import './PlayQueue.css';

const { Text } = Typography;

interface PlayQueueProps {
  visible: boolean;
  onClose: () => void;
}

const PlayQueue: React.FC<PlayQueueProps> = ({ visible, onClose }) => {
  const { playlist, currentTrack, play, removeFromPlaylist, clearPlaylist, reorderPlaylist } = usePlayerStore();

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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const fromIdx = result.source.index;
    const toIdx = result.destination.index;
    if (fromIdx === toIdx) return;
    const newPlaylist = [...playlist];
    const [moved] = newPlaylist.splice(fromIdx, 1);
    newPlaylist.splice(toIdx, 0, moved);
    reorderPlaylist(newPlaylist);
  };


  return (
    <Drawer
      title={`播放队列 (${playlist.length})`}
      placement="right"
      onClose={onClose}
      open={visible}
      width={window.innerWidth < 480 ? '100%' : 400}
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
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="play-queue">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {playlist.map((track, index) => {
                  const isCurrentTrack = track.id === currentTrack?.id;
                  return (
                    <Draggable key={String(track.id)} draggableId={String(track.id)} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`queue-item ${isCurrentTrack ? 'current' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                        >
                          <div className="queue-item-row">
                            <div className="queue-drag-handle" {...dragProvided.dragHandleProps}>
                              <HolderOutlined />
                            </div>
                            <div className="queue-item-number">
                              {isCurrentTrack ? '▶' : index + 1}
                            </div>
                            <div className="queue-item-meta">
                              <Text strong={isCurrentTrack} className="queue-item-title">
                                {track.title}
                              </Text>
                              <Text type="secondary" className="queue-item-duration">
                                {formatDuration(track.duration)}
                              </Text>
                            </div>
                            <div className="queue-item-actions">
                              <Button
                                type="text"
                                icon={<PlayCircleOutlined />}
                                onClick={() => handlePlayTrack(track)}
                                disabled={isCurrentTrack}
                                title="播放"
                                size="small"
                              />
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
                                  title="移除"
                                  size="small"
                                />
                              </Popconfirm>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </Drawer>
  );
};

export default PlayQueue;


