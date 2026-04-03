import React, { useEffect, useState } from 'react';
import {
  Collapse, Button, Modal, Form, Input, message, Space, Popconfirm,
  ColorPicker, Card, Select, Tag as AntTag, InputNumber, List, Badge, Checkbox
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined,
  FolderOutlined, TagOutlined, PlusCircleOutlined
} from '@ant-design/icons';
import {
  getTags, createTag, updateTag, deleteTag, Tag,
  getTagGroups, TagGroup, bulkDeleteTags, bulkMoveTagsToGroup
} from '../services/tagService';
import AdminLayout from '../components/AdminLayout';
import AdminActionBar from '../components/admin/AdminActionBar';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import TagGroupManager from '../components/TagGroupManager';
import './TagManagement.css';

const { TextArea } = Input;

// 分组名称中英文映射
const GROUP_NAME_MAP: { [key: string]: string } = {
  'Game Categories': '游戏分类',
  'Music Styles': '音乐风格',
  'Languages': '语言',
  'Emotions': '情感',
  'Scenarios': '场景',
  'Others': '其他'
};

// 获取显示名称（中文优先）
const getDisplayName = (name: string): string => {
  return GROUP_NAME_MAP[name] || name;
};

const TagManagement: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupManagerVisible, setGroupManagerVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [parentTagId, setParentTagId] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchTags(), fetchGroups()]);
  };

  const fetchTags = async () => {
    try {
      const data = await getTags();
      setTags(data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      message.error('获取标签失败');
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await getTagGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const handleCreate = (groupId?: number, parentId?: number) => {
    setEditingTag(null);
    setParentTagId(parentId || null);
    form.resetFields();
    form.setFieldsValue({
      color: '#1890ff',
      group_id: groupId || null,
      parent_id: parentId || null,
      display_order: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setParentTagId(tag.parent_id || null);
    form.setFieldsValue({
      name: tag.name,
      color: tag.color,
      description: tag.description,
      group_id: tag.group_id,
      parent_id: tag.parent_id,
      icon: tag.icon,
      display_order: tag.display_order || 0
    });
    setModalVisible(true);
  };

  const handleParentTagChange = (value: number | null) => {
    setParentTagId(value);

    if (value) {
      const parentTag = tags.find((tag) => tag.id === value);
      form.setFieldValue('group_id', parentTag?.group_id ?? null);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const colorValue = typeof values.color === 'string'
        ? values.color
        : values.color?.toHexString?.() || '#1890ff';

      const tagData = {
        name: values.name,
        color: colorValue,
        description: values.description,
        group_id: values.group_id || null,
        parent_id: values.parent_id || null,
        icon: values.icon || null,
        display_order: values.display_order || 0
      };

      if (editingTag) {
        await updateTag(editingTag.id, tagData);
        message.success('标签更新成功');
      } else {
        await createTag(tagData);
        message.success('标签创建成功');
      }
      setModalVisible(false);
      fetchTags();
    } catch (error: any) {
      console.error('Failed to save tag:', error);
      if (error.response?.data?.error?.code === 'DUPLICATE') {
        message.error('标签名称已存在');
      } else if (error.response?.data?.error?.message) {
        message.error(error.response.data.error.message);
      } else {
        message.error(editingTag ? '更新标签失败' : '创建标签失败');
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTag(id);
      message.success('标签删除成功');
      setSelectedTagIds((prev) => prev.filter((tagId) => tagId !== id));
      fetchTags();
    } catch (error) {
      console.error('Failed to delete tag:', error);
      message.error('删除标签失败');
    }
  };

  const toggleSelectTag = (tagId: number, checked: boolean) => {
    setSelectedTagIds((prev) => {
      if (checked) {
        return prev.includes(tagId) ? prev : [...prev, tagId];
      }
      return prev.filter((id) => id !== tagId);
    });
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedTagIds([]);
        setBulkGroupId(null);
      }
      return !prev;
    });
  };

  const handleSelectAllTags = () => {
    setSelectedTagIds(tags.map((tag) => tag.id));
  };

  const handleClearSelection = () => {
    setSelectedTagIds([]);
  };

  const handleBulkMove = async () => {
    if (selectedTagIds.length === 0) {
      message.warning('请先选择要批量更新的标签');
      return;
    }

    const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
    if (selectedTags.length === 0) {
      message.warning('未找到可更新的标签');
      return;
    }

    setBulkLoading(true);
    try {
      const result = await bulkMoveTagsToGroup(selectedTags, bulkGroupId);
      if (result.failed.length === 0) {
        message.success(`成功更新 ${result.successIds.length} 个标签分组`);
      } else {
        message.warning(`已更新 ${result.successIds.length} 个，失败 ${result.failed.length} 个`);
      }
      setSelectedTagIds([]);
      fetchTags();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTagIds.length === 0) {
      message.warning('请先选择要删除的标签');
      return;
    }

    const selectedSet = new Set(selectedTagIds);
    const parentById = new Map(tags.map((tag) => [tag.id, tag.parent_id ?? null] as const));
    const hasSelectedAncestor = (tagId: number) => {
      let cursor = parentById.get(tagId) ?? null;
      while (cursor) {
        if (selectedSet.has(cursor)) return true;
        cursor = parentById.get(cursor) ?? null;
      }
      return false;
    };

    const deleteTargets = selectedTagIds.filter((tagId) => !hasSelectedAncestor(tagId));
    if (deleteTargets.length === 0) {
      message.warning('没有可删除的目标标签');
      return;
    }

    Modal.confirm({
      title: '批量删除标签',
      content: `确定删除 ${deleteTargets.length} 个标签吗？（已自动排除被父标签覆盖的子标签）`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setBulkLoading(true);
        try {
          const result = await bulkDeleteTags(deleteTargets);
          if (result.failed.length === 0) {
            message.success(`成功删除 ${result.successIds.length} 个标签`);
          } else {
            message.warning(`已删除 ${result.successIds.length} 个，失败 ${result.failed.length} 个`);
          }
          setSelectedTagIds([]);
          fetchTags();
        } finally {
          setBulkLoading(false);
        }
      }
    });
  };

  // 按分组组织tags
  const organizedTags = React.useMemo(() => {
    const grouped: { [key: string]: Tag[] } = {
      ungrouped: []
    };

    groups.forEach(group => {
      grouped[group.id] = [];
    });

    tags.forEach(tag => {
      if (tag.parent_id) return; // 跳过子tags，它们会在父tag下显示

      if (tag.group_id && grouped[tag.group_id]) {
        grouped[tag.group_id].push(tag);
      } else {
        grouped.ungrouped.push(tag);
      }
    });

    return grouped;
  }, [tags, groups]);

  // 获取子tags
  const getChildTags = (parentId: number): Tag[] => {
    return tags.filter(t => t.parent_id === parentId);
  };

  // 渲染Tag项
  const renderTagItem = (tag: Tag, level: number = 0) => {
    const children = getChildTags(tag.id);

    return (
      <div key={tag.id} style={{ marginLeft: level * 24 }}>
        <List.Item
          actions={[
            <Button
              type="text"
              size="small"
              icon={<PlusCircleOutlined />}
              onClick={() => handleCreate(tag.group_id || undefined, tag.id)}
              title="添加子标签"
            >
              子标签
            </Button>,
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(tag)}
            />,
            <Popconfirm
              title="确定要删除这个标签吗？"
              description="删除后将同时删除所有子标签"
              onConfirm={() => handleDelete(tag.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ]}
        >
          <List.Item.Meta
            avatar={
              <div style={{
                width: 32,
                height: 32,
                backgroundColor: tag.color,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 16
              }}>
                {tag.icon || <TagOutlined />}
              </div>
            }
            title={
              <Space>
                {selectionMode && (
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={(e) => toggleSelectTag(tag.id, e.target.checked)}
                  />
                )}
                <strong>{tag.name}</strong>
                {tag.parent_name && (
                  <AntTag color="default" style={{ fontSize: 11 }}>
                    {tag.parent_name} 的子标签
                  </AntTag>
                )}
                <Badge count={tag.track_count || 0} showZero color="#1890ff" />
                {children.length > 0 && (
                  <AntTag color="purple">{children.length} 个子标签</AntTag>
                )}
              </Space>
            }
            description={tag.description || '暂无描述'}
          />
        </List.Item>
        {children.length > 0 && (
          <div style={{ marginLeft: 24, borderLeft: '2px solid #f0f0f0', paddingLeft: 12 }}>
            {children.map(child => renderTagItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 获取可选的父标签（排除自己和自己的后代）
  const getAvailableParentTags = (): Tag[] => {
    if (!editingTag) return tags.filter(t => !t.parent_id);

    // 排除自己和自己的子孙
    const excludeIds = new Set([editingTag.id]);
    const addDescendants = (parentId: number) => {
      tags.filter(t => t.parent_id === parentId).forEach(child => {
        excludeIds.add(child.id);
        addDescendants(child.id);
      });
    };
    addDescendants(editingTag.id);

    return tags.filter(t => !excludeIds.has(t.id) && !t.parent_id);
  };

  return (
    <AdminLayout>
      <div className="tag-management-page">
      <AdminPageHeader
        title="标签管理"
        description="将标签分组、层级关系与批量操作整合在同一工作区。"
      />
      <Card
        title="标签列表与分组"
        extra={
          <AdminActionBar compact>
            <Button
              onClick={handleToggleSelectionMode}
            >
              {selectionMode ? '退出批量模式' : '批量管理'}
            </Button>
            <Button
              icon={<AppstoreOutlined />}
              onClick={() => setGroupManagerVisible(true)}
            >
              管理分组
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleCreate()}
            >
              创建标签
            </Button>
          </AdminActionBar>
        }
      >
        {selectionMode && (
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space wrap>
              <AntTag color="processing">已选 {selectedTagIds.length} 个标签</AntTag>
              <Button size="small" onClick={handleSelectAllTags}>全选</Button>
              <Button size="small" onClick={handleClearSelection}>清空选择</Button>
              <Select
                allowClear
                placeholder="批量设置分组（清空=未分组）"
                style={{ width: 260 }}
                value={bulkGroupId}
                onChange={(value) => setBulkGroupId(value ?? null)}
                options={groups.map((g) => ({
                  label: `${g.icon || '📁'} ${getDisplayName(g.name)}`,
                  value: g.id
                }))}
              />
              <Button
                type="primary"
                loading={bulkLoading}
                disabled={selectedTagIds.length === 0}
                onClick={handleBulkMove}
              >
                批量改分组
              </Button>
              <Button
                danger
                loading={bulkLoading}
                disabled={selectedTagIds.length === 0}
                onClick={handleBulkDelete}
              >
                批量删除
              </Button>
            </Space>
          </Card>
        )}

        <Collapse
          defaultActiveKey={groups.map(g => g.id.toString()).concat(['ungrouped'])}
          items={[
            ...groups.map(group => {
              const groupTags = organizedTags[group.id] || [];
              return {
                key: group.id.toString(),
                label: (
                  <Space>
                    <span style={{ fontSize: 18 }}>{group.icon || '📁'}</span>
                    <strong>{getDisplayName(group.name)}</strong>
                    <AntTag color="blue">{groupTags.length} 个标签</AntTag>
                  </Space>
                ),
                extra: (
                  <Button
                    size="small"
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreate(group.id);
                    }}
                  >
                    添加标签
                  </Button>
                ),
                children: groupTags.length > 0 ? (
                  <List
                    dataSource={groupTags}
                    renderItem={tag => renderTagItem(tag)}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    暂无标签，点击上方"添加标签"创建
                  </div>
                )
              };
            }),
            ...(organizedTags.ungrouped && organizedTags.ungrouped.length > 0 ? [{
              key: 'ungrouped',
              label: (
                <Space>
                  <FolderOutlined />
                  <strong>未分组</strong>
                  <AntTag>{organizedTags.ungrouped.length} 个标签</AntTag>
                </Space>
              ),
              children: (
                <List
                  dataSource={organizedTags.ungrouped}
                  renderItem={tag => renderTagItem(tag)}
                />
              )
            }] : [])
          ]}
        />
      </Card>

      {/* Tag编辑/创建Modal */}
      <Modal
        title={editingTag ? '编辑标签' : '创建标签'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="例如：原神、蒙德、风之歌" />
          </Form.Item>

          <Form.Item
            name="group_id"
            label="所属分组"
          >
            <Select
              placeholder="选择分组（可选）"
              allowClear
              options={groups.map(g => ({
                label: `${g.icon || '📁'} ${g.name}`,
                value: g.id
              }))}
            />
          </Form.Item>

          <Form.Item
            name="parent_id"
            label="父级标签"
            extra={parentTagId ? "此标签将成为所选标签的子标签" : "留空则为顶级标签"}
          >
            <Select
              placeholder="选择父级标签（可选）"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={getAvailableParentTags().map(t => ({
                label: `${t.icon || '🏷️'} ${t.name}`,
                value: t.id
              }))}
              onChange={(value) => handleParentTagChange(value ?? null)}
            />
          </Form.Item>

          <Form.Item
            name="color"
            label="标签颜色"
            rules={[{ required: true, message: '请选择标签颜色' }]}
          >
            <ColorPicker showText />
          </Form.Item>

          <Form.Item name="icon" label="图标">
            <Input placeholder="例如：🎮 或留空" />
          </Form.Item>

          <Form.Item name="display_order" label="显示顺序">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="数字越小越靠前" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="标签的描述信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tag分组管理Modal */}
      <TagGroupManager
        visible={groupManagerVisible}
        onClose={() => setGroupManagerVisible(false)}
        onGroupsChanged={fetchData}
      />
      </div>
    </AdminLayout>
  );
};

export default TagManagement;

