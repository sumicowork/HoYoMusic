import React, { useEffect, useState } from 'react';
import {
  Modal,
  Tag,
  Button,
  Select,
  message,
  Space,
  Input,
  Form,
  InputNumber,
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
  getTagGroups,
  Tag as TagType,
  TagGroup,
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
  const { TextArea } = Input;

  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [trackTags, setTrackTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTagId, setAddingTagId] = useState<number | undefined>(undefined);
  const [createParentTagId, setCreateParentTagId] = useState<number | null>(null);

  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#1890ff');
  const [editTagDescription, setEditTagDescription] = useState('');
  const [createForm] = Form.useForm();

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, trackId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tags, currentTags, tagGroups] = await Promise.all([
        getTags(),
        getTrackTags(trackId),
        getTagGroups(),
      ]);
      setAllTags(tags);
      setTrackTags(currentTags);
      setGroups(tagGroups);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
    createForm.setFieldsValue({
      color: '#1890ff',
      group_id: null,
      parent_id: null,
      icon: null,
      display_order: 0,
      description: '',
      name: '',
    });
    setCreateParentTagId(null);
  }, [visible, createForm]);

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
    try {
      const values = await createForm.validateFields();
      const colorValue = typeof values.color === 'string'
        ? values.color
        : values.color?.toHexString?.() || '#1890ff';

      setLoading(true);
      const created = await createTag({
        name: values.name.trim(),
        color: colorValue,
        description: values.description?.trim() || undefined,
        group_id: values.group_id || null,
        parent_id: values.parent_id || null,
        icon: values.icon?.trim() || null,
        display_order: values.display_order || 0,
      });
      await addTagToTrack(trackId, created.id);
      message.success('标签创建并添加成功');

      const preservedGroupId = values.group_id || null;
      const preservedParentId = values.parent_id || null;

      createForm.setFieldsValue({
        name: '',
        color: '#1890ff',
        description: '',
        group_id: preservedGroupId,
        parent_id: preservedParentId,
        icon: null,
        display_order: 0,
      });
      setCreateParentTagId(preservedParentId);

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

  const availableParentTags = allTags.filter(tag => !tag.parent_id);

  const getChildTrackTags = (parentId: number): TagType[] => {
    return trackTags.filter((tag) => tag.parent_id === parentId);
  };

  const trackTagIdSet = new Set(trackTags.map((tag) => tag.id));
  const rootTrackTags = trackTags.filter((tag) => !tag.parent_id || !trackTagIdSet.has(tag.parent_id));

  const renderTrackTagItem = (tag: TagType, level: number = 0): React.ReactNode => {
    const children = getChildTrackTags(tag.id);

    return (
      <div key={tag.id} style={{ marginLeft: level * 16 }}>
        <div
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

        {children.length > 0 && (
          <div
            style={{
              marginLeft: 18,
              borderLeft: '2px solid #f0f0f0',
              paddingLeft: 10,
              marginTop: 8,
              display: 'grid',
              gap: 8,
            }}
          >
            {children.map((child) => renderTrackTagItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

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
            {rootTrackTags.map((tag) => renderTrackTagItem(tag))}
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
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            color: '#1890ff',
            group_id: null,
            parent_id: null,
            icon: null,
            display_order: 0,
            description: '',
            name: '',
          }}
        >
          <Form.Item
            name="name"
            label="标签名称"
            rules={[
              { required: true, message: '请输入标签名称' },
              { max: 50, message: '标签名称最多 50 个字符' },
            ]}
          >
            <Input placeholder="例如：原神、蒙德、风之歌" maxLength={50} />
          </Form.Item>

          <Form.Item name="group_id" label="所属分组">
            <Select
              placeholder="选择分组（可选）"
              allowClear
              options={groups.map((g) => ({
                label: `${g.icon || '📁'} ${g.name}`,
                value: g.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="parent_id"
            label="父级标签"
            extra={createParentTagId ? '此标签将成为所选标签的子标签' : '留空则为顶级标签'}
          >
            <Select
              placeholder="选择父级标签（可选）"
              allowClear
              options={availableParentTags.map((t) => ({
                label: `${t.icon || '🏷️'} ${t.name}`,
                value: t.id,
              }))}
              onChange={(value) => {
                const parentId = value ?? null;
                setCreateParentTagId(parentId);

                if (parentId) {
                  const parentTag = allTags.find((tag) => tag.id === parentId);
                  createForm.setFieldValue('group_id', parentTag?.group_id ?? null);
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="color"
            label="标签颜色"
            rules={[{ required: true, message: '请选择标签颜色' }]}
          >
            <ColorPicker showText />
          </Form.Item>

          <Form.Item
            name="icon"
            label="图标"
            rules={[{ max: 50, message: '图标最多 50 个字符' }]}
          >
            <Input placeholder="例如：🎮 或留空" maxLength={50} />
          </Form.Item>

          <Form.Item name="display_order" label="显示顺序">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="数字越小越靠前" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ max: 500, message: '描述最多 500 个字符' }]}
          >
            <TextArea rows={3} placeholder="标签的描述信息（可选）" maxLength={500} showCount />
          </Form.Item>

          <Button type="primary" loading={loading} onClick={handleCreateAndAttachTag}>
            新建并添加
          </Button>
        </Form>
      </div>
    </Modal>
  );
};

export default TrackTagsManager;

