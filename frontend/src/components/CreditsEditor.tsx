import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, List, message, Space, InputNumber } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Credit {
  id: number;
  credit_key: string;
  credit_value: string;
  display_order: number;
}

interface CreditsEditorProps {
  trackId: number;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreditsEditor: React.FC<CreditsEditorProps> = ({ trackId, visible, onClose, onSuccess }) => {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      fetchCredits();
    }
  }, [visible, trackId]);

  const fetchCredits = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/credits/${trackId}/credits`);
      if (response.data.success) {
        setCredits(response.data.data.credits);
      }
    } catch (error) {
      console.error('获取制作人员信息失败:', error);
    }
  };

  const handleEdit = (credit: Credit) => {
    setEditingCredit(credit);
    form.setFieldsValue(credit);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (editingCredit) {
        await axios.put(
          `${API_BASE_URL}/credits/${trackId}/credits/${editingCredit.id}`,
          values,
          { headers }
        );
        message.success('制作人员信息已更新');
      } else {
        await axios.post(
          `${API_BASE_URL}/credits/${trackId}/credits`,
          values,
          { headers }
        );
        message.success('已添加制作人员信息');
      }

      form.resetFields();
      setEditingCredit(null);
      fetchCredits();
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (creditId: number) => {
    Modal.confirm({
      title: '删除制作人员信息',
      content: '确定要删除此条目吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(
            `${API_BASE_URL}/credits/${trackId}/credits/${creditId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          message.success('已删除');
          fetchCredits();
          onSuccess();
        } catch (error: any) {
          message.error(error.response?.data?.error?.message || '删除失败');
        }
      }
    });
  };

  return (
    <Modal
      title="管理制作人员"
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
        <Form.Item
          name="credit_key"
          label="键（如：作曲、编曲、演唱）"
          rules={[{ required: true, message: '请输入键名' }]}
        >
          <Input placeholder="输入键名，如：作曲" />
        </Form.Item>

        <Form.Item
          name="credit_value"
          label="值（人名或描述）"
          rules={[{ required: true, message: '请输入值' }]}
        >
          <Input placeholder="输入人名或描述" />
        </Form.Item>

        <Form.Item
          name="display_order"
          label="显示顺序"
          initialValue={0}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleSave} loading={loading}>
              {editingCredit ? '更新' : '添加'}
            </Button>
            {editingCredit && (
              <Button onClick={() => { form.resetFields(); setEditingCredit(null); }}>
                取消编辑
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>

      <List
        header={<div><strong>已有制作人员信息</strong></div>}
        bordered
        dataSource={credits}
        renderItem={(credit) => (
          <List.Item
            actions={[
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(credit)}
              />,
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(credit.id)}
              />,
            ]}
          >
            <List.Item.Meta
              title={credit.credit_key}
              description={credit.credit_value}
            />
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default CreditsEditor;

