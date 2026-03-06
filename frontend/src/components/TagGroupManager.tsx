import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, List, message, Space, Popconfirm, InputNumber, Select, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined, ApartmentOutlined } from '@ant-design/icons';
import {
  TagGroup,
  getTagGroups,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup
} from '../services/tagService';

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

const getDisplayName = (name: string): string => GROUP_NAME_MAP[name] || name;

// Build tree from flat list
function buildGroupTree(groups: TagGroup[]): TagGroup[] {
  const map: Record<number, TagGroup> = {};
  const roots: TagGroup[] = [];
  groups.forEach(g => { map[g.id] = { ...g, children: [] }; });
  groups.forEach(g => {
    if (g.parent_group_id && map[g.parent_group_id]) {
      map[g.parent_group_id].children!.push(map[g.id]);
    } else {
      roots.push(map[g.id]);
    }
  });
  return roots;
}

interface TagGroupManagerProps {
  visible: boolean;
  onClose: () => void;
  onGroupsChanged?: () => void;
}

const TagGroupManager: React.FC<TagGroupManagerProps> = ({ visible, onClose, onGroupsChanged }) => {
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TagGroup | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) fetchGroups();
  }, [visible]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await getTagGroups();
      setGroups(data);
    } catch {
      message.error('获取标签分组失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (parentId?: number) => {
    setEditingGroup(null);
    form.resetFields();
    form.setFieldsValue({ display_order: groups.length, parent_group_id: parentId ?? null });
    setModalVisible(true);
  };

  const handleEdit = (group: TagGroup) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      description: group.description,
      icon: group.icon,
      display_order: group.display_order,
      parent_group_id: group.parent_group_id ?? null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTagGroup(id);
      message.success('删除成功');
      fetchGroups();
      onGroupsChanged?.();
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'HAS_TAGS') {
        message.error('该分组下还有标签，无法删除。请先移除或删除标签。');
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values, parent_group_id: values.parent_group_id || null };
      if (editingGroup) {
        await updateTagGroup(editingGroup.id, payload);
        message.success('更新成功');
      } else {
        await createTagGroup(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchGroups();
      onGroupsChanged?.();
    } catch {
      message.error('操作失败');
    }
  };

  // Recursive render for tree
  const renderGroupItem = (group: TagGroup, depth = 0) => (
    <React.Fragment key={group.id}>
      <List.Item
        style={{ paddingLeft: depth * 24 }}
        actions={[
          <Button
            type="text"
            size="small"
            icon={<ApartmentOutlined />}
            onClick={() => handleAdd(group.id)}
            title="添加子分组"
          />,
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(group)} />,
          <Popconfirm
            title="删除分组"
            description="确定要删除此分组吗？如果分组下有标签将无法删除。"
            onConfirm={() => handleDelete(group.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          avatar={
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: depth > 0
                ? 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 16
            }}>
              {group.icon || (depth > 0 ? '📂' : '📁')}
            </div>
          }
          title={
            <Space>
              {depth > 0 && <Tag color="purple" style={{ fontSize: 10 }}>子分组</Tag>}
              <strong>{getDisplayName(group.name)}</strong>
              <span style={{ color: '#999', fontSize: 12 }}>{group.tag_count || 0} 个标签</span>
            </Space>
          }
          description={group.description || '暂无描述'}
        />
      </List.Item>
      {(group.children || []).map(child => renderGroupItem(child, depth + 1))}
    </React.Fragment>
  );

  const tree = buildGroupTree(groups);
  // Flat options for parent selector (exclude self when editing)
  const parentOptions = groups
    .filter(g => !editingGroup || g.id !== editingGroup.id)
    .map(g => ({ value: g.id, label: `${g.icon || '📁'} ${getDisplayName(g.name)}` }));

  return (
    <>
      <Modal
        title={<Space><AppstoreOutlined /><span>标签分组管理</span></Space>}
        open={visible}
        onCancel={onClose}
        width={700}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
            新建顶级分组
          </Button>,
          <Button key="close" onClick={onClose}>关闭</Button>
        ]}
      >
        <List
          loading={loading}
          dataSource={tree}
          renderItem={(group) => renderGroupItem(group, 0)}
        />
      </Modal>

      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={handleSubmit}
        okText={editingGroup ? '更新' : '创建'}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="如：游戏分类、音乐风格" maxLength={50} />
          </Form.Item>
          <Form.Item name="parent_group_id" label="父分组" extra="留空则为顶级分组">
            <Select
              allowClear
              placeholder="选择父分组（可选）"
              options={[{ value: null, label: '无（顶级分组）' }, ...parentOptions]}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea placeholder="分组的简要说明（可选）" rows={3} maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="icon" label="图标" extra="可以使用Emoji，如：🎮 🎵 🌍">
            <Input placeholder="如：🎮 或 🎵" maxLength={50} />
          </Form.Item>
          <Form.Item name="display_order" label="显示顺序" extra="数字越小越靠前">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TagGroupManager;

