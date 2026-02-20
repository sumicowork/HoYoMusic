import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, List, message, Space, Popconfirm, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
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

// 获取显示名称（中文优先）
const getDisplayName = (name: string): string => {
  return GROUP_NAME_MAP[name] || name;
};

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
    if (visible) {
      fetchGroups();
    }
  }, [visible]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await getTagGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch tag groups:', error);
      message.error('获取标签分组失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingGroup(null);
    form.resetFields();
    form.setFieldsValue({ display_order: groups.length });
    setModalVisible(true);
  };

  const handleEdit = (group: TagGroup) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      description: group.description,
      icon: group.icon,
      display_order: group.display_order
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

      if (editingGroup) {
        await updateTagGroup(editingGroup.id, values);
        message.success('更新成功');
      } else {
        await createTagGroup(values);
        message.success('创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      fetchGroups();
      onGroupsChanged?.();
    } catch (error) {
      message.error('操作失败');
    }
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <AppstoreOutlined />
            <span>标签分组管理</span>
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={700}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建分组
          </Button>,
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
      >
        <List
          loading={loading}
          dataSource={groups}
          renderItem={(group) => (
            <List.Item
              actions={[
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(group)}
                />,
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
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 18
                  }}>
                    {group.icon || '📁'}
                  </div>
                }
                title={
                  <Space>
                    <strong>{getDisplayName(group.name)}</strong>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {group.tag_count || 0} 个标签
                    </span>
                  </Space>
                }
                description={group.description || '暂无描述'}
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={handleSubmit}
        okText={editingGroup ? '更新' : '创建'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="如：游戏分类、音乐风格" maxLength={50} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea
              placeholder="分组��简要说明（可选）"
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="icon"
            label="图标"
            extra="可以使用Emoji或Ant Design图��名称，如：GamepadOutlined"
          >
            <Input placeholder="如：🎮 或 GamepadOutlined" maxLength={50} />
          </Form.Item>

          <Form.Item
            name="display_order"
            label="显示顺序"
            extra="数字越小越靠前"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TagGroupManager;


