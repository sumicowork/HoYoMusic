import React, { useEffect, useState } from 'react';
import { Modal, Tag, Button, Select, message, Space } from 'antd';
import { getTags, getTrackTags, addTagToTrack, removeTagFromTrack, Tag as TagType } from '../services/tagService';

interface TrackTagsManagerProps {
  visible: boolean;
  trackId: number;
  trackTitle: string;
  onClose: () => void;
  onTagsUpdated?: () => void;
}

const TrackTagsManager: React.FC<TrackTagsManagerProps> = ({
  visible,
  trackId,
  trackTitle,
  onClose,
  onTagsUpdated
}) => {
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [trackTags, setTrackTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, trackId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tags, currentTags] = await Promise.all([
        getTags(),
        getTrackTags(trackId)
      ]);
      setAllTags(tags);
      setTrackTags(currentTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tagId: number) => {
    try {
      await addTagToTrack(trackId, tagId);
      message.success('标签添加成功');
      fetchData();
      onTagsUpdated?.();
    } catch (error: any) {
      console.error('Failed to add tag:', error);
      if (error.response?.data?.error?.code === 'DUPLICATE') {
        message.warning('该标签已添加');
      } else {
        message.error('添加标签失败');
      }
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await removeTagFromTrack(trackId, tagId);
      message.success('标签移除成功');
      fetchData();
      onTagsUpdated?.();
    } catch (error) {
      console.error('Failed to remove tag:', error);
      message.error('移除标签失败');
    }
  };

  const availableTags = allTags.filter(
    tag => !trackTags.some(t => t.id === tag.id)
  );

  return (
    <Modal
      title={`管理标签 - ${trackTitle}`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={600}
    >
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 12 }}>当前标签：</h4>
        {trackTags.length === 0 ? (
          <p style={{ color: '#999' }}>暂无标签</p>
        ) : (
          <Space wrap>
            {trackTags.map(tag => (
              <Tag
                key={tag.id}
                color={tag.color}
                closable
                onClose={() => handleRemoveTag(tag.id)}
                style={{ fontSize: 14, padding: '4px 8px' }}
              >
                {tag.name}
              </Tag>
            ))}
          </Space>
        )}
      </div>

      <div>
        <h4 style={{ marginBottom: 12 }}>添加标签：</h4>
        {availableTags.length === 0 ? (
          <p style={{ color: '#999' }}>没有可添加的标签</p>
        ) : (
          <Select
            style={{ width: '100%' }}
            placeholder="选择标签"
            loading={loading}
            onChange={handleAddTag}
            value={undefined}
            options={availableTags.map(tag => ({
              value: tag.id,
              label: (
                <span>
                  <Tag color={tag.color} style={{ marginRight: 8 }}>
                    {tag.name}
                  </Tag>
                  {tag.description && (
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {tag.description}
                    </span>
                  )}
                </span>
              )
            }))}
          />
        )}
      </div>

      <div style={{ marginTop: 24, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
          💡 提示：您可以在"标签管理"页面创建新标签
        </p>
      </div>
    </Modal>
  );
};

export default TrackTagsManager;

