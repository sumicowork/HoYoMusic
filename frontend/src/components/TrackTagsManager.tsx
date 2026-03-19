import React, { useEffect, useState } from 'react';
import {
  Modal,
  Tag,
  Button,
  Select,
  message,
  Space,
  Input,
  ColorPicker,
  Popconfirm,
  Divider,
} from 'antd';
import {
  getTags,
  getTrackTags,
  addTagToTrack,
  removeTagFromTrack,
  createTag,
  updateTag,
  deleteTag,
  Tag as TagType,
} from '../services/tagService';

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
  const [addingTagId, setAddingTagId] = useState<number | undefined>(undefined);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#1890ff');
  const [newTagDescription, setNewTagDescription] = useState('');

  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#1890ff');
  const [editTagDescription, setEditTagDescription] = useState('');

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
      setAddingTagId(tagId);
      await addTagToTrack(trackId, tagId);
      message.success('标签添加成功');
      await fetchData();
      onTagsUpdated?.();
    } catch (error: any) {
      console.error('Failed to add tag:', error);
      if (error.response?.data?.error?.code === 'DUPLICATE') {
        message.warning('该标签已添加');
      } else {
        message.error('添加标签失败');
      }
    } finally {
      setAddingTagId(undefined);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await removeTagFromTrack(trackId, tagId);
      message.success('标签移除成功');
      await fetchData();
      onTagsUpdated?.();
    } catch (error) {
      console.error('Failed to remove tag:', error);
      message.error('移除标签失败');
    }
  };

  const handleCreateAndAttachTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      message.warning('请输入标签名称');
      return;
    }

    try {
      setLoading(true);
      const created = await createTag({
        name,
        color: newTagColor,
        description: newTagDescription.trim() || undefined,
      });
      await addTagToTrack(trackId, created.id);
      message.success('标签创建并添加成功');

      setNewTagName('');
      setNewTagColor('#1890ff');
      setNewTagDescription('');

      await fetchData();
      onTagsUpdated?.();
    } catch (error: any) {
      console.error('Failed to create or attach tag:', error);
      if (error.response?.data?.error?.code === 'DUPLICATE') {
        message.error('标签名称已存在，请直接选择该标签');
      } else if (error.response?.data?.error?.message) {
        message.error(error.response.data.error.message);
      } else {
        message.error('创建标签失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const startEditTag = (tag: TagType) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color || '#1890ff');
    setEditTagDescription(tag.description || '');
  };

  const cancelEditTag = () => {
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('#1890ff');
    setEditTagDescription('');
  };

  const handleUpdateTag = async (tagId: number) => {
    const name = editTagName.trim();
    if (!name) {
      message.warning('标签名称不能为空');
      return;
    }

    try {
      setLoading(true);
      await updateTag(tagId, {
        name,
        color: editTagColor,
        description: editTagDescription.trim() || undefined,
      });
      message.success('标签更新成功');
      cancelEditTag();
      await fetchData();
      onTagsUpdated?.();
    } catch (error: any) {
      console.error('Failed to update tag:', error);
      if (error.response?.data?.error?.code === 'DUPLICATE') {
        message.error('标签名称已存在');
      } else if (error.response?.data?.error?.message) {
        message.error(error.response.data.error.message);
      } else {
        message.error('更新标签失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    try {
      setLoading(true);
      await deleteTag(tagId);
      message.success('标签删除成功');
      cancelEditTag();
      await fetchData();
      onTagsUpdated?.();
    } catch (error: any) {
      console.error('Failed to delete tag:', error);
      if (error.response?.data?.error?.message) {
        message.error(error.response.data.error.message);
      } else {
        message.error('删除标签失败');
      }
    } finally {
      setLoading(false);
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
          <div style={{ display: 'grid', gap: 8 }}>
            {trackTags.map(tag => (
              <div
                key={tag.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 10px',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                }}
              >
                {editingTagId === tag.id ? (
                  <Space wrap style={{ flex: 1 }}>
                    <Input
                      value={editTagName}
                      onChange={(e) => setEditTagName(e.target.value)}
                      placeholder="标签名称"
                      style={{ width: 180 }}
                      maxLength={50}
                    />
                    <ColorPicker
                      value={editTagColor}
                      onChange={(color) => setEditTagColor(color.toHexString())}
                      showText
                    />
                    <Input
                      value={editTagDescription}
                      onChange={(e) => setEditTagDescription(e.target.value)}
                      placeholder="描述（可选）"
                      style={{ width: 220 }}
                      maxLength={200}
                    />
                  </Space>
                ) : (
                  <Space wrap style={{ flex: 1 }}>
                    <Tag color={tag.color} style={{ fontSize: 14, padding: '4px 8px' }}>
                      {tag.name}
                    </Tag>
                    {tag.description && (
                      <span style={{ color: '#999', fontSize: 12 }}>{tag.description}</span>
                    )}
                  </Space>
                )}

                <Space>
                  {editingTagId === tag.id ? (
                    <>
                      <Button size="small" type="primary" loading={loading} onClick={() => handleUpdateTag(tag.id)}>
                        保存
                      </Button>
                      <Button size="small" onClick={cancelEditTag}>
                        取消
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="small" onClick={() => startEditTag(tag)}>
                        编辑
                      </Button>
                      <Button size="small" onClick={() => handleRemoveTag(tag.id)}>
                        移除
                      </Button>
                      <Popconfirm
                        title="确定删除该标签吗？"
                        description="该操作会全局删除标签，并影响所有歌曲"
                        onConfirm={() => handleDeleteTag(tag.id)}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      <div>
        <h4 style={{ marginBottom: 12 }}>从已有标签中添加：</h4>
        {availableTags.length === 0 ? (
          <p style={{ color: '#999' }}>没有可添加的标签</p>
        ) : (
          <Select
            style={{ width: '100%' }}
            placeholder="选择标签"
            loading={loading}
            value={addingTagId}
            onChange={(value) => {
              setAddingTagId(undefined);
              handleAddTag(value);
            }}
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

      <div style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 12 }}>就地新建并添加标签：</h4>
        <Space wrap>
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="标签名称"
            style={{ width: 180 }}
            maxLength={50}
          />
          <ColorPicker
            value={newTagColor}
            onChange={(color) => setNewTagColor(color.toHexString())}
            showText
          />
          <Input
            value={newTagDescription}
            onChange={(e) => setNewTagDescription(e.target.value)}
            placeholder="描述（可选）"
            style={{ width: 220 }}
            maxLength={200}
          />
          <Button type="primary" loading={loading} onClick={handleCreateAndAttachTag}>
            新建并添加
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default TrackTagsManager;

